// api/notion.js
export default async function handler(req, res) {
  // CORS 설정 (프론트엔드와 통신하기 위해 필요)
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
  
  // 수정 포인트: text 대신 task가 안 들어왔는지 확인하도록 변경
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
          // 노션 데이터베이스의 '할 일' 컬럼 이름이 '할 일'인 경우
          "할 일": {
            title: [
              {
                text: {
                  content: task
                }
              }
            ]
          },
          // 체크박스 속성 이름이 'DONE'인 경우
          "DONE": {
            checkbox: !!done // 안전하게 boolean 값으로 변환
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
