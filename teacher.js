// Vercel Serverless Function
// Proxies Teacher Portal requests to Google Apps Script.

const ALLOWED_ACTIONS = new Set(['dashboard', 'classes', 'student', 'history']);

module.exports = async function handler(req, res) {
  try {
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      return res.status(500).json({
        success: false,
        message: 'APPS_SCRIPT_URL is not configured.'
      });
    }

    const params = req.query || {};
    const action = String(params.action || '').trim();

    if (!ALLOWED_ACTIONS.has(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher API action.'
      });
    }

    const target = new URL(appsScriptUrl);
    target.searchParams.set('api', 'teacher');
    target.searchParams.set('action', action);

    if (action === 'student' || action === 'history') {
      const id = String(params.id || '').trim();
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required.'
        });
      }
      target.searchParams.set('id', id);
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow',
      cache: 'no-store'
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        success: false,
        message: 'Google Apps Script did not return valid JSON.',
        upstreamStatus: upstream.status
      });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(upstream.ok ? 200 : 502).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Teacher API request failed.'
    });
  }
};
