// api/notion.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  try {
    // 1. [GET] 노션 DB에서 생성일시 기준으로 목록 가져오기
    if (req.method === 'GET') {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
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
              direction: 'ascending' // 오래된 것이 위로, 새로운 것이 아래로 (위젯 입력 순서와 일치)
            }
          ]
        })
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
            "할 IT": { title: [{ text: { content: task } }] }, // 만약 속성 이름이 '할 일'이면 여기를 "할 일"로 맞춰주세요!
            "DONE": { checkbox: !!done }
            // 날짜는 노션 DB 속성을 '생성일시(Created time)'로 해두었으므로 알아서 자동 입력됩니다!
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Notion API Error');
      return res.status(200).json({ success: true, data });
    }

    // 3. [PATCH] 완료 체크 상태 업데이트 OR 삭제(아카이브) 처리
    if (req.method === 'PATCH') {
      const { pageId, done, archived } = req.body;

      if (!pageId) {
        return res.status(400).json({ error: 'pageId is required' });
      }

      let updateBody = {};
      
      // 만약 삭제 요청(archived: true)이라면 노션 페이지를 휴지통으로 보냄
      if (archived) {
        updateBody = { archived: true };
      } else {
        // 일반적인 완료 체크박스 업데이트
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
