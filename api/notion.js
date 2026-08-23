// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 1. GET 요청 처리: 노션 DB에서 할 일 목록 불러오기 (양방향 읽기)
  if (req.method === 'GET') {
    const { notionToken, notionDb } = req.query;
    const AUTH_TOKEN = notionToken || process.env.NOTION_TOKEN;
    const DATABASE_ID = notionDb || process.env.NOTION_DATABASE_ID;

    if (!AUTH_TOKEN || !DATABASE_ID) {
      return res.status(500).json({ error: 'Missing Notion token or database id.' });
    }

    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST', // 노션 API 규격상 데이터베이스 조회는 POST를 사용합니다.
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
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Notion Query Error Detail:', data);
        return res.status(500).json({ error: data.message || 'Notion API Query Error' });
      }

      // 노션 데이터 구조를 위젯에 맞는 형태({ id, text, completed, notionPageId })로 변환
      const todos = data.results.map(page => {
        const props = page.properties;
        
        // '할 일' 타이틀 속성 추출
        let taskText = '';
        if (props['할 일'] && props['할 일'].title && props['할 일'].title.length > 0) {
          taskText = props['할 일'].title.map(t => t.plain_text).join('');
        }

        // 'DONE' 체크박스 속성 추출
        const isDone = props['DONE'] ? props['DONE'].checkbox : false;

        return {
          id: page.id, // 고유 ID로 노션 페이지 ID 사용
          text: taskText,
          completed: isDone,
          notionPageId: page.id
        };
      });

      return res.status(200).json({ success: true, todos });
    } catch (error) {
      console.error('Server GET catch error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // 2. POST 및 PATCH 요청 처리: 기존 생성 및 수정 로직
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { task, done, pageId, notionToken, notionDb } = req.body;

  const AUTH_TOKEN = notionToken || process.env.NOTION_TOKEN;
  const DATABASE_ID = notionDb || process.env.NOTION_DATABASE_ID;

  if (!AUTH_TOKEN || !DATABASE_ID) {
    return res.status(500).json({ error: 'Missing Notion token or database id.' });
  }

  try {
    let response;

    if (pageId) {
      response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          properties: {
            "DONE": { checkbox: !!done }
          }
        })
      });
    } else {
      if (!task || task.trim() === "") {
        return res.status(200).json({ success: true, message: "No task provided, skipped creation." });
      }

      const today = new Date().toISOString().split('T')[0];

      response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: {
            "할 일": {
              title: [
                { text: { content: task } }
              ]
            },
            "DONE": {
              checkbox: !!done
            },
            "날짜": {
              date: { start: today }
            }
          }
        })
      });
    }

    const data = await response.json();
    if (!response.ok) {
      console.error('Notion API Error Detail:', data);
      return res.status(500).json({ error: data.message || 'Notion API Error' });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Server catch error:', error);
    return res.status(200).json({ error: error.message });
  }
}
