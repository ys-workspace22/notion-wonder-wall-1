// api/notion.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ====================================
  // CORS
  // ====================================
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
      success: false,
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

  if (!NOTION_TOKEN) {
    return res.status(500).json({
      success: false,
      error: 'NOTION_TOKEN is not configured'
    });
  }

  if (!DATABASE_ID) {
    return res.status(500).json({
      success: false,
      error: 'NOTION_DATABASE_ID is not configured'
    });
  }

  const todayISO = new Date().toISOString().split('T')[0];

  try {

    // ====================================
    // GET
    // Notion DB → 위젯
    //
    // Notion에서 추가/수정/체크/삭제된
    // 현재 상태를 그대로 가져옵니다.
    // ====================================
    if (req.method === 'GET') {

      let allResults = [];
      let startCursor = undefined;

      do {
        const body = {
          sorts: [
            {
              timestamp: 'created_time',
              direction: 'ascending'
            }
          ],
          page_size: 100
        };

        if (startCursor) {
          body.start_cursor = startCursor;
        }

        const response = await fetch(
          `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify(body)
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Notion Query Error'
          );
        }

        allResults = allResults.concat(
          data.results || []
        );

        startCursor = data.has_more
          ? data.next_cursor
          : undefined;

      } while (startCursor);


      const todos = allResults
        // 삭제/보관된 페이지는 위젯에 표시하지 않음
        .filter(page => !page.archived)
        .map(page => {

          const props = page.properties || {};

          // ====================================
          // 할 일 제목
          // ====================================
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

          // ====================================
          // 날짜
          // ====================================
          let date = null;

          if (
            props['생성일시'] &&
            props['생성일시'].created_time
          ) {
            date = props['생성일시'].created_time || null;
          }

          // ====================================
          // 위젯으로 전달
          // ====================================
          return {
            id: page.id,
            notionPageId: page.id,

            text: taskText,

            completed:
              props['DONE']?.checkbox || false,

            date,

            lastEditedTime:
              page.last_edited_time
          };
        });

      return res.status(200).json({
        success: true,
        todos
      });
    }


    // ====================================
    // DELETE
    //
    // 위젯 X
    //     ↓
    // Notion 해당 페이지 삭제
    //
    // Notion API에서는 archived=true로
    // 페이지를 휴지통으로 보냅니다.
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
        throw new Error(
          data.message || 'Notion Delete Error'
        );
      }

      return res.status(200).json({
        success: true,
        deletedPageId: pageId
      });
    }


    // ====================================
    // PATCH
    //
    // 위젯 → Notion
    //
    // 체크뿐 아니라
    // 제목 수정 + 체크 상태 수정까지 지원
    // ====================================
    if (req.method === 'PATCH') {

      const {
        pageId,
        task,
        done
      } = req.body || {};

      if (!pageId) {
        return res.status(400).json({
          success: false,
          error: 'pageId is required'
        });
      }

      const properties = {};

      // ====================================
      // 제목 수정
      // ====================================
      if (
        typeof task === 'string'
      ) {
        properties['할 일'] = {
          title: [
            {
              text: {
                content: task
              }
            }
          ]
        };
      }

      // ====================================
      // 체크 상태 수정
      // ====================================
      if (
        typeof done !== 'undefined'
      ) {
        properties.DONE = {
          checkbox: !!done
        };
      }

      if (
        Object.keys(properties).length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Nothing to update'
        });
      }

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
            properties
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Notion Update Error'
        );
      }

      return res.status(200).json({
        success: true,
        data
      });
    }


    // ====================================
    // POST
    //
    // 기존 방식 그대로 유지
    //
    // pageId 없음
    // → 새 할 일 생성
    //
    // pageId 있음
    // → 기존 할 일 수정
    //
    // 이렇게 해두면 기존 위젯 코드와
    // 호환될 가능성이 높습니다.
    // ====================================
    if (req.method === 'POST') {

      const {
        task,
        done,
        pageId
      } = req.body || {};


      // ====================================
      // POST + pageId
      //
      // 기존 할 일 수정
      // ====================================
      if (pageId) {

        const properties = {};

        // 제목이 전달되면 제목 수정
        if (
          typeof task === 'string'
        ) {
          properties['할 일'] = {
            title: [
              {
                text: {
                  content: task
                }
              }
            ]
          };
        }

        // done이 전달되면 체크 상태 수정
        if (
          typeof done !== 'undefined'
        ) {
          properties.DONE = {
            checkbox: !!done
          };
        }

        if (
          Object.keys(properties).length === 0
        ) {
          return res.status(400).json({
            success: false,
            error: 'Nothing to update'
          });
        }

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
              properties
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Notion Update Error'
          );
        }

        return res.status(200).json({
          success: true,
          data
        });
      }


      // ====================================
      // POST + pageId 없음
      //
      // 새 할 일 생성
      // ====================================
      if (!task || task.trim() === '') {
        return res.status(200).json({
          success: true,
          message: 'No task provided'
        });
      }

      const response = await fetch(
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

  // 할 일
  '할 일': {
    title: [
      {
        text: {
          content: task
        }
      }
    ]
  },

  // 완료 여부
  DONE: {
    checkbox: !!done
  }
}
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Notion Create Error'
        );
      }

      return res.status(200).json({
        success: true,
        data
      });
    }

  } catch (error) {

    console.error(
      'Notion API Error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
