// api/auth/login.js
export default function handler(req, res) {
  const CLIENT_ID = process.env.NOTION_OAUTH_CLIENT_ID;
  const REDIRECT_URI = process.env.NOTION_OAUTH_REDIRECT_URI;

  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send('OAuth 환경변수가 설정되지 않았습니다.');
  }

  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');

  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}
