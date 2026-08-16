// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { task, done, pageId } = req.body;
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return res.status(500).json({ error: "Missing NOTION_TOKEN or NOTION_DATABASE_ID environment variables." });
  }

  try {
    let response;
    
    if (pageId) {
      // ✅ 기존 행의 체크박스 상태만 업데이트
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
      // ✅ 새로운 할 일 행 생성 (날짜 데이터 아예 제외)
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
              title: [{ text: { content: task } }]
            },
            "DONE": {
              checkbox: !!done
            }
          }
        })
      });
    }

    const data = await response.json();
    if (!response.ok) {
      console.error("Notion API Error Detail:", data);
      return res.status(500).json({ error: data.message || 'Notion API Error' });
    }

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error("Server catch error:", error);
    return res.status(500).json({ error: error.message });
  }
}
