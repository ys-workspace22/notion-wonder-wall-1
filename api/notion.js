// api/notion.js
export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { task, done } = req.body;
  
  // 할 일 내용이 없는 경우 에러 반환
  if (!task) {
    return res.status(400).json({ error: 'Task is required' });
  }

  // Vercel 환경 변수에서 토큰과 DB ID 가져오기
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  try {
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
          // 노션 데이터베이스의 '할 일' 컬럼
          "할 일": {
            title: [
              {
                text: {
                  content: task
                }
              }
            ]
          },
          // 체크박스 속성 'DONE' (초기 생성 시에는 false 또는 전달받은 값)
          "DONE": {
            checkbox: !!done
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Notion API Error');
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
