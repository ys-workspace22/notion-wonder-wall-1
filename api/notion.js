// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (
    req.method !== 'GET' &&
    req.method !== 'POST' &&
    req.method !== 'PATCH' &&
    req.method !== 'DELETE'
  ) {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const NOTION_TOKEN =
    req.query?.notionToken ||
    req.body?.notionToken ||
    process.env.NOTION_TOKEN;

  const DATABASE_ID =
    req.query?.notionDb ||
    req.body?.notionDb ||
    process.env.NOTION_DATABASE_ID;

  const todayISO = new Date().toISOString().split('T')[0];

  try {
    // ====================================
    // GET : Notion DB → 위젯
    // ====================================
    if (req.method === 'GET') {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
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
        throw new Error(data.message || 'Notion Query Error');
      }

      const todos = data.results.map(page => {
        const props = page.properties || {};

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

        return {
          id: page.id,
          notionPageId: page.id,
          text: taskText,
          completed: props['DONE']?.checkbox || false,
          date: props['날짜']?.date?.start || null,
          lastEditedTime: page.last_edited_time
        };
      });

      return res.status(200).json({
        success: true,
        todos
      });
    }

    // ====================================
    // DELETE : 위젯 X → Notion DB에서 삭제
    // ====================================
    if (req.method === 'DELETE') {
      const pageId =
        req.query?.pageId ||
        req.body?.pageId;

      if (!pageId) {
        return res.status(400).json({
          success: false,
          error: 'pageId is required'
        });
      }

      /*
       * Notion API에서는 페이지를 삭제할 때
       * archived: true 로 보내서 휴지통으로 보냅니다.
       */
      const response = await fetch(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
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
        throw new Error(data.message || 'Notion Delete Error');
      }

      return res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
        data
      });
    }

    // ====================================
    // PATCH : 체크 상태 수정
    // ====================================
    const { task, done, pageId } = req.body || {};

    let response;

    if (pageId) {
      response = await fetch(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            properties: {
              DONE: {
                checkbox: !!done
              }
            }
          })
        }
      );
    }

    // ====================================
    // POST : 새 할 일 생성
    // ====================================
    else {
      if (!task || task.trim() === '') {
        return res.status(200).json({
          success: true,
          message: 'No task provided'
        });
      }

      response = await fetch(
        'https://api.notion.com/v1/pages',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
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
                      content: task
                    }
                  }
                ]
              },
              DONE: {
                checkbox: !!done
              },
              날짜: {
                date: {
                  start: todayISO
                }
              }
            }
          })
        }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Notion API Error');
    }

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```
