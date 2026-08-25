// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  try {
    // 1. GET 요청: 노션 DB에서 할 일 목록을 불러올 때 (생성일 기준 오름차순으로 정렬하여 위젯과 순서 일치)
    if (req.method === 'GET') {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST', // 노션 API query는 POST 방식을 사용합니다.
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          sorts: [
            {
              timestamp: 'created_time',
              direction: 'ascending' // 처음에 입력한 것이 맨 위로 오도록 오름차순 정렬
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Notion API Error');
      }
      return res.status(200).json({ success: true, data: data.results });
    }

    // 2. POST / PATCH 요청: 할 일 생성 또는 완료 체크 업데이트
    if (req.method === 'POST' || req.method === 'PATCH') {
      const { task, done, pageId } = req.body;
      const todayISO = new Date().toISOString().split('T')[0];
      let response;

      if (pageId) {
        // 기존 할 일의 체크박스(DONE) 상태 업데이트
        response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
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
        // 새로운 할 일 생성
        if (!task || task.trim() === "") {
          return res.status(200).json({ success: true, message: "No task provided, skipped creation." });
        }
        response = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
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
                date: { start: todayISO }
              }
            }
          })
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Notion API Error');
      }
      return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
