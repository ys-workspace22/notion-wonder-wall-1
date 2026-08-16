// api/notion.js
export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { task, done, pageId } = req.body;
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  // 오늘 날짜 (YYYY-MM-DD 형식, Notion Date 속성이 요구하는 포맷)
  const todayISO = new Date().toISOString().split('T')[0];

  try {
    let response;
    if (pageId) {
      // ✅ pageId가 있으면 = 기존 행이 이미 있다는 뜻 → 새로 만들지 않고 업데이트만
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
      // pageId가 없을 때만 = 새로 추가하는 할 일일 때만 새 행 생성
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
