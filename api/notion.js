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
    // 1. [GET] 노션 DB 목록 불러오기 (정렬 강제 적용 없이 원본 그대로 가져옴)
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

    // 2. [POST] 새로운 할 일 생성
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

    // 3. [PATCH] 완료 체크 상태 업데이트 OR 삭제(archived) 처리
    if (req.method === 'PATCH') {
      const { pageId, done, archived } = req.body;

      if (!pageId) {
        return res.status(400).json({ error: 'pageId is required' });
      }

      let updateBody = {};
      
      // 삭제 요청인 경우 아카이브(휴지통 처리)
      if (archived) {
        updateBody = { archived: true };
      } else {
        // 체크박스 상태 변경인 경우
        updateBody = {
          properties: {
            "DONE": { checkbox: !!done }
          }
        };
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
