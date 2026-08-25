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
    // 1. [GET] 노션 DB에 있는 데이터 목록을 위젯으로 가져오기 (이게 있어야 노션에서 쓴 게 위젯에 뜸!)
    if (req.method === 'GET') {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Notion API Error');
      return res.status(200).json({ success: true, data: data.results });
    }

    // 2. [POST] 위젯에서 새 할 일을 추가할 때
    if (req.method === 'POST') {
      const { task, done } = req.body;

      if (!task || task.trim() === "") {
        return res.status(200).json({ success: true, message: "No task provided." });
      }

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: {
            "할 일": { title: [{ text: { content: task } }] },
            "DONE": { checkbox: !!done }
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Notion API Error');
      return res.status(200).json({ success: true, data });
    }

    // 3. [PATCH] 완료 체크 상태 변경 혹은 삭제(archived) 처리
    if (req.method === 'PATCH') {
      const { pageId, done, archived } = req.body;

      if (!pageId) {
        return res.status(400).json({ error: 'pageId is required' });
      }

      let updateBody = {};
      if (archived) {
        updateBody = { archived: true }; // 삭제
      } else {
        updateBody = { properties: { "DONE": { checkbox: !!done } } }; // 체크 상태 변경
      }

      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(updateBody)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Notion API Error');
      return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
