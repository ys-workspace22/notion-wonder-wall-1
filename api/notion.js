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
    // 1. [양방향 연동 - GET] 위젯이 노션 DB의 할 일 목록을 실시간으로 불러올 때
    if (req.method === 'GET') {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST', // 노션 API query는 POST 방식으로 요청합니다.
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          // 노션 DB 정렬을 건드리지 않고, 최신순/오래된순을 여기서 제어할 수 있습니다.
          // 필요에 따라 sorts 배열을 조절할 수 있습니다.
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Notion API Error');
      }

      // 노션에서 가져온 데이터 배열을 위젯 순서에 맞게 필요시 여기서 뒤집을 수도 있습니다.
      return res.status(200).json({ success: true, data: data.results });
    }

    // 2. [POST / PATCH] 할 일 생성 및 체크박스(DONE) 상태 업데이트
    if (req.method === 'POST' || req.method === 'PATCH') {
      const { task, done, pageId } = req.body;
      const todayISO = new Date().toISOString().split('T')[0];
      let response;

      if (pageId) {
        // 기존 할 일의 체크박스 상태 업데이트 (양방향 반영)
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
        // 새로운 할 일 생성 (날짜도 자동으로 쏙 들어갑니다!)
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
