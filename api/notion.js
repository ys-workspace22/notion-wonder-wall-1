// api/notion.js

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --------------------------------------------------
  // 공통: Notion 인증 정보 가져오기
  // --------------------------------------------------
  const getNotionConfig = () => {
    const notionToken =
      req.method === 'GET'
        ? req.query.notionToken
        : req.body?.notionToken;

    const notionDb =
      req.method === 'GET'
        ? req.query.notionDb
        : req.body?.notionDb;

    return {
      AUTH_TOKEN: notionToken || process.env.NOTION_TOKEN,
      DATABASE_ID: notionDb || process.env.NOTION_DATABASE_ID
    };
  };

  const { AUTH_TOKEN, DATABASE_ID } = getNotionConfig();

  if (!AUTH_TOKEN || !DATABASE_ID) {
    return res.status(500).json({
      error: 'Missing Notion token or database id.'
    });
  }

  // ==================================================
  // 1. GET
  // Notion DB → 위젯
  // ==================================================
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            sorts: [
              {
                timestamp: 'created_time',
                direction: 'ascending'
              }
            ]
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Notion GET Error:', data);

        return res.status(response.status).json({
          error: data.message || 'Notion API Query Error'
        });
      }

      // --- [여기부터 교체된 부분입니다] ---
      const today = new Date().toLocaleDateString('sv-SE', {
        timeZone: 'Asia/Seoul'
      });
      
      const todos = await Promise.all(
        data.results.map(async page => {
          const props = page.properties || {};

          // ------------------------------
          // '할 일' 제목 가져오기
          // ------------------------------
          let taskText = '';

          if (
            props['할 일'] &&
            props['할 일'].title &&
            props['할 일'].title.length > 0
          ) {
            taskText = props['할 일'].title
              .map(item => item.plain_text || '')
              .join('');
          }

          // ------------------------------
          // 'DONE' 체크박스 가져오기
          // ------------------------------
          const isDone =
            props['DONE']?.checkbox === true;

          // ------------------------------
          // '날짜' 확인
          // ------------------------------
          const existingDate =
            props['날짜']?.date?.start || null;

          // 날짜가 비어 있으면 오늘 날짜 자동 입력
          if (!existingDate && taskText.trim() !== '') {
            try {
              await fetch(
                `https://api.notion.com/v1/pages/${page.id}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                  },
                  body: JSON.stringify({
                    properties: {
                      '날짜': {
                        date: {
                          start: today
                        }
                      }
                    }
                  })
                }
              );
            } catch (error) {
              console.error(
                '날짜 자동 입력 실패:',
                error
              );
            }
          }

          return {
            id: page.id,
            text: taskText,
            completed: isDone,
            notionPageId: page.id,
            date: existingDate || today,
            lastEditedTime: page.last_edited_time
          };
        })
      );
      // --- [교체 끝] ---

      return res.status(200).json({
        success: true,
        todos
      });

    } catch (error) {
      console.error('Server GET catch error:', error);

      return res.status(500).json({
        error: error.message
      });
    }
  }

  // ==================================================
  // 2. POST (기존 그대로 유지)
  // ==================================================
  if (req.method === 'POST') {
    const {
      task,
      done = false
    } = req.body || {};

    if (!task || task.trim() === '') {
      return res.status(400).json({
        error: 'Task is required.'
      });
    }

    try {
      const today = new Date()
        .toISOString()
        .split('T')[0];

      const response = await fetch(
        'https://api.notion.com/v1/pages',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            parent: {
              database_id: DATABASE_ID
            },

            properties: {
              '할 일': {
                title: [
                  {
                    text: {
                      content: task.trim()
                    }
                  }
                ]
              },

              'DONE': {
                checkbox: !!done
              },

              '날짜': {
                date: {
                  start: today
                }
              }
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Notion POST Error:', data);

        return res.status(response.status).json({
          error: data.message || 'Notion API Create Error'
        });
      }

      return res.status(200).json({
        success: true,
        data
      });

    } catch (error) {
      console.error('Server POST catch error:', error);

      return res.status(500).json({
        error: error.message
      });
    }
  }

  // ==================================================
  // 3. PATCH (기존 그대로 유지)
  // ==================================================
  if (req.method === 'PATCH') {
    const {
      pageId,
      task,
      done
    } = req.body || {};

    if (!pageId) {
      return res.status(400).json({
        error: 'pageId is required.'
      });
    }

    try {
      const properties = {};

      if (typeof task === 'string') {
        properties['할 일'] = {
          title: [
            {
              text: {
                content: task.trim()
              }
            }
          ]
        };
      }

      if (typeof done === 'boolean') {
        properties['DONE'] = {
          checkbox: done
        };
      }

      if (Object.keys(properties).length === 0) {
        return res.status(400).json({
          error: 'Nothing to update.'
        });
      }

      const response = await fetch(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            properties
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Notion PATCH Error:', data);

        return res.status(response.status).json({
          error: data.message || 'Notion API Update Error'
        });
      }

      return res.status(200).json({
        success: true,
        data
      });

    } catch (error) {
      console.error('Server PATCH catch error:', error);

      return res.status(500).json({
        error: error.message
      });
    }
  }

  // ==================================================
  // 4. DELETE (기존 그대로 유지)
  // ==================================================
  if (req.method === 'DELETE') {
    const {
      pageId,
      notionToken,
      notionDb
    } = req.body || {};

    const deleteToken =
      notionToken || process.env.NOTION_TOKEN;

    if (!pageId) {
      return res.status(400).json({
        error: 'pageId is required.'
      });
    }

    if (!deleteToken) {
      return res.status(500).json({
        error: 'Missing Notion token.'
      });
    }

    try {
      const response = await fetch(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${deleteToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            archived: true
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Notion DELETE Error:', data);

        return res.status(response.status).json({
          error: data.message || 'Notion API Delete Error'
        });
      }

      return res.status(200).json({
        success: true,
        data
      });

    } catch (error) {
      console.error('Server DELETE catch error:', error);

      return res.status(500).json({
        error: error.message
      });
    }
  }

  return res.status(405).json({
    error: 'Method not allowed'
  });
}
