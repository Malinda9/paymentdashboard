// api/teacher.js
// Vercel Serverless Function
// Teacher Portal API -> Google Apps Script
//
// This version supports GET and POST from the frontend,
// forwards the session token, and sends POST to Apps Script.

const ALLOWED_ACTIONS = new Set([
  'login',
  'me',
  'dashboard',
  'classes',
  'student',
  'history'
]);

module.exports = async function handler(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase();

    // Read request data from either GET query or POST body.
    let params = {};

    if (method === 'POST') {
      if (req.body && typeof req.body === 'object') {
        params = req.body;
      } else {
        params = {};
      }
    } else {
      params = req.query || {};
    }

    const action = String(params.action || '').trim().toLowerCase();

    if (!ALLOWED_ACTIONS.has(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid teacher API action.'
      });
    }

    const appsScriptUrl = process.env.APPS_SCRIPT_URL;

    if (!appsScriptUrl) {
      return res.status(500).json({
        success: false,
        message: 'APPS_SCRIPT_URL is not configured.'
      });
    }

    const body = {
      action: action
    };

    // Login fields
    if (action === 'login') {
      body.username = String(params.username || '').trim();
      body.password = String(params.password || '');

      if (!body.username || !body.password) {
        return res.status(400).json({
          success: false,
          message: 'Username និង Password ត្រូវបានទាមទារ។'
        });
      }
    } else {
      // Session token for all protected requests.
      body.token = String(params.token || '').trim();

      if (!body.token) {
        return res.status(401).json({
          success: false,
          message: 'Session token មិនមាន។ សូម Login ម្តងទៀត។'
        });
      }
    }

    // Student ID is required for student/history.
    if (action === 'student' || action === 'history') {
      body.id = String(params.id || '').trim();

      if (!body.id) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required.'
        });
      }
    }

    const upstream = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      redirect: 'follow',
      cache: 'no-store'
    });

    const text = await upstream.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Apps Script response:', text);

      return res.status(502).json({
        success: false,
        message: 'Google Apps Script did not return valid JSON.',
        upstreamStatus: upstream.status
      });
    }

    res.setHeader(
      'Cache-Control',
      'no-store, max-age=0, must-revalidate'
    );

    return res
      .status(upstream.ok ? 200 : upstream.status || 502)
      .json(data);

  } catch (error) {
    console.error('Teacher API error:', error);

    return res.status(500).json({
      success: false,
      message: 'Teacher API request failed.'
    });
  }
};
