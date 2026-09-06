// ==========================================================
// VERCEL SERVERLESS FUNCTION — PHASE 3A
// Teacher Portal API
// ==========================================================

const ALLOWED_ACTIONS = new Set([
  'login',
  'me',
  'dashboard',
  'classes',
  'student',
  'history'
]);

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

function sendJson(res, status, body) {
  Object.entries(JSON_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(body);
}

function getRequestData(req) {

  // POST JSON body
  if (req && req.body && typeof req.body === 'object') {
    return req.body;
  }

  // POST body as JSON string
  if (req && typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }

  // GET fallback for older Teacher Portal
  return req && req.query ? req.query : {};
}

function buildPayload(data, action) {

  const payload = {
    action: action
  };

  // LOGIN
  if (action === 'login') {

    payload.username = String(
      data.username || ''
    ).trim();

    payload.password = String(
      data.password || ''
    );

  } else {

    // Protected actions
    payload.token = String(
      data.token || ''
    ).trim();
  }

  // Student / History
  if (
    action === 'student' ||
    action === 'history'
  ) {

    payload.id = String(
      data.id || ''
    ).trim();
  }

  return payload;
}

module.exports = async function handler(req, res) {

  // ========================================================
  // CORS
  // ========================================================

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ========================================================
  // GOOGLE APPS SCRIPT URL
  // ========================================================

  const appsScriptUrl =
    String(
      process.env.APPS_SCRIPT_URL || ''
    ).trim();

  if (!appsScriptUrl) {

    return sendJson(res, 500, {

      success: false,

      message:
        'APPS_SCRIPT_URL is not configured.'
    });
  }

  try {

    // ======================================================
    // READ REQUEST
    // ======================================================

    const data =
      getRequestData(req);

    const action =
      String(
        data.action || ''
      )
      .trim()
      .toLowerCase();

    // ======================================================
    // VALIDATE ACTION
    // ======================================================

    if (!ALLOWED_ACTIONS.has(action)) {

      return sendJson(res, 400, {

        success: false,

        message:
          'Invalid teacher API action.',

        allowedActions:
          Array.from(ALLOWED_ACTIONS)
      });
    }

    // ======================================================
    // BUILD PAYLOAD
    // ======================================================

    const payload =
      buildPayload(
        data,
        action
      );

    // ======================================================
    // LOGIN VALIDATION
    // ======================================================

    if (action === 'login') {

      if (
        !payload.username ||
        !payload.password
      ) {

        return sendJson(res, 400, {

          success: false,

          message:
            'Username និង Password ត្រូវបានទាមទារ។'
        });
      }
    }

    // ======================================================
    // SESSION TOKEN VALIDATION
    // ======================================================

    if (
      action !== 'login' &&
      !payload.token
    ) {

      return sendJson(res, 401, {

        success: false,

        message:
          'Session token ត្រូវបានទាមទារ។ សូម Login ម្តងទៀត។'
      });
    }

    // ======================================================
    // STUDENT ID VALIDATION
    // ======================================================

    if (
      (
        action === 'student' ||
        action === 'history'
      ) &&
      !payload.id
    ) {

      return sendJson(res, 400, {

        success: false,

        message:
          'Student ID is required.'
      });
    }

    // ======================================================
    // SEND TO GOOGLE APPS SCRIPT
    // ======================================================

    const upstream =
      await fetch(
        appsScriptUrl,
        {

          method: 'POST',

          headers: {

            'Content-Type':
              'application/json',

            'Accept':
              'application/json'
          },

          body:
            JSON.stringify(payload),

          redirect:
            'follow',

          cache:
            'no-store'
        }
      );

    // ======================================================
    // READ RESPONSE
    // ======================================================

    const text =
      await upstream.text();

    if (!text) {

      return sendJson(res, 502, {

        success: false,

        message:
          'Google Apps Script returned an empty response.',

        upstreamStatus:
          upstream.status
      });
    }

    // ======================================================
    // PARSE JSON
    // ======================================================

    let result;

    try {

      result =
        JSON.parse(text);

    } catch (e) {

      console.error(
        'Invalid JSON from Apps Script:',
        text
      );

      return sendJson(res, 502, {

        success: false,

        message:
          'Google Apps Script did not return valid JSON.',

        upstreamStatus:
          upstream.status
      });
    }

    // ======================================================
    // HTTP STATUS FROM APPS SCRIPT
    // ======================================================

    let status =
      Number(
        result &&
        result.httpStatus
      );

    if (
      !Number.isInteger(status) ||
      status < 200 ||
      status > 599
    ) {

      status =
        upstream.ok
          ? 200
          : 502;
    }

    // Remove internal httpStatus
    delete result.httpStatus;

    // ======================================================
    // RETURN RESPONSE
    // ======================================================

    return sendJson(
      res,
      status,
      result
    );

  } catch (error) {

    console.error(
      'Teacher API error:',
      error
    );

    return sendJson(res, 500, {

      success: false,

      message:
        'Teacher API request failed.',

      error:
        String(
          error &&
          error.message
            ? error.message
            : error
        )
    });
  }
};
