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
    // 1. [GET] 노션 DB 데이터를 읽어와서 프론트엔드가 바로 쓸 수 있는 깔끔한 형태로 변환하여 전달
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

      // 노션의 복잡한 JSON 구조를 프론트엔드가 쉽게 읽을 수 있도록 평평하게(flat) 가공
      const formattedResults = data.results.map((page) => {
        const titleProp = page.properties["할 일"]?.title;
        const taskText = titleProp && titleProp.length > 0 ? titleProp[0].plain_text : "";
        const doneProp = page.properties["DONE"]?.checkbox ?? false;

        return {
          id: page.id,
          task: taskText,
          done: doneProp
        };
      });

      return res.status(200).json({ success: true, data: formattedResults });
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
