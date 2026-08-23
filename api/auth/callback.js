// api/auth/callback.js
export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?notion_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.status(400).send('인증 코드가 없습니다.');
  }

  const CLIENT_ID = process.env.NOTION_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = process.env.NOTION_OAUTH_CLIENT_SECRET;
  const REDIRECT_URI = process.env.NOTION_OAUTH_REDIRECT_URI;

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send('OAuth 환경변수가 설정되지 않았습니다.');
  }

  try {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Notion token exchange failed:', tokenData);
      return res.redirect(`/?notion_error=${encodeURIComponent(tokenData.error || 'token_exchange_failed')}`);
    }

    const accessToken = tokenData.access_token;

    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        page_size: 1
      })
    });

    const searchData = await searchResponse.json();
    const firstDatabase = searchData.results && searchData.results[0];

    if (!firstDatabase) {
      return res.redirect(
        `/?notion_error=${encodeURIComponent('no_database_found')}&notion_token=${encodeURIComponent(accessToken)}`
      );
    }

    const databaseId = firstDatabase.id;

    return res.redirect(
      `/?notion_token=${encodeURIComponent(accessToken)}&notion_db=${encodeURIComponent(databaseId)}`
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.redirect(`/?notion_error=${encodeURIComponent('server_error')}`);
  }
}
