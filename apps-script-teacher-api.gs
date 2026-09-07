// ==========================================================
// PHASE 3A — TEACHER PORTAL
// Version: ALL TEACHERS CAN VIEW ALL CLASSES
// School: បឋមសិក្សាសម្តេចព្រះរាជអគ្គមហេសី
// ==========================================================

var TP_SESSION_TTL = 21600; // 6 hours

// ----------------------------------------------------------
// VERCEL -> APPS SCRIPT API
// Vercel api/teacher.js sends POST requests here.
// ----------------------------------------------------------
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (parseErr) { return tpJson_({success:false,message:'Request JSON មិនត្រឹមត្រូវ។'}, 400); }
    }

    var action = String(body.action || '').trim().toLowerCase();

    // Login is shared by Teacher Portal and Admin Portal.
    if (action === 'login') {
      var login = teacherPortalLogin_(body.username, body.password);
      return tpJson_(login, login.success ? 200 : 401);
    }

    var session = teacherPortalGetSession_(body.token);
    if (!session) {
      return tpJson_({success:false,message:'Session ផុតកំណត់ ឬ Token មិនត្រឹមត្រូវ។ សូម Login ម្តងទៀត។'}, 401);
    }

    if (action === 'me') {
      return tpJson_({success:true,data:{user:teacherPortalPublicUser_(session)}}, 200);
    }

    // ---------------- TEACHER ACTIONS ----------------
    if (action === 'dashboard') {
      return tpJson_({success:true,data:teacherPortalDashboard_(session)}, 200);
    }
    if (action === 'classes') {
      return tpJson_({success:true,data:teacherPortalClasses_(session)}, 200);
    }
    if (action === 'student') {
      return tpJson_({success:true,data:teacherPortalStudent_(session, body.id)}, 200);
    }
    if (action === 'history') {
      return tpJson_({success:true,data:teacherPortalHistory_(session, body.id)}, 200);
    }

    // ---------------- ADMIN ACTIONS ----------------
    if (!teacherPortalIsAdmin_(session)) {
      return tpJson_({success:false,message:'មុខងារនេះអាចប្រើបានសម្រាប់ Admin ប៉ុណ្ណោះ។'}, 403);
    }

    if (action === 'admin_dashboard') return tpJson_({success:true,data:adminPortalDashboard_()},200);
    if (action === 'admin_students') return tpJson_({success:true,data:adminPortalStudents_(body.filters || {})},200);
    if (action === 'admin_student') return tpJson_({success:true,data:adminPortalStudent_(body.id)},200);
    if (action === 'admin_save_student') return tpJson_(adminPortalSaveStudent_(body.student || {}, session),200);
    if (action === 'admin_archive_student') return tpJson_(adminPortalArchiveStudent_(body.id),200);
    if (action === 'admin_payments') return tpJson_({success:true,data:adminPortalPayments_(body.filters || {})},200);
    if (action === 'admin_data_health') return tpJson_({success:true,data:adminPortalDataHealth_(body.query)},200);
    if (action === 'admin_save_payment') return tpJson_(adminPortalSavePayment_(body.payment || {}, session),200);
    if (action === 'admin_delete_payment') return tpJson_(adminPortalDeletePayment_(body.rowNumber),200);
    if (action === 'admin_teachers') return tpJson_({success:true,data:adminPortalTeachers_()},200);
    if (action === 'admin_users') return tpJson_({success:true,data:adminPortalUsers_()},200);
    if (action === 'admin_save_user') return tpJson_(adminPortalSaveUser_(body.user || {}),200);
    if (action === 'admin_toggle_user') return tpJson_(adminPortalToggleUser_(body.username, body.active),200);
    if (action === 'admin_export_csv') return tpJson_(adminPortalExportCsv_(body.filters || {}),200);
    if (action === 'admin_daily_report') return tpJson_({success:true,data:adminPortalDailyReport_(body.date)},200);
    if (action === 'admin_monthly_report') return tpJson_({success:true,data:adminPortalMonthlyReport_(body.month)},200);

    return tpJson_({success:false,message:'Action មិនត្រូវបានអនុញ្ញាត។'},400);
  } catch (err) {
    console.error(err);
    return tpJson_({success:false,message:'Server Error: ' + err.message},500);
  }
}

// ----------------------------------------------------------
// JSON RESPONSE
// ----------------------------------------------------------
function tpJson_(obj, status) {
  obj.httpStatus = status || 200;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------
// TEACHER_USERS SHEET
//
// A Username
// B PasswordHash
// C Role
// D Name
// E AllowedClasses
// F Active
// G CreatedAt
//
// NOTE:
// Teacher role now has access to ALL classes.
// AllowedClasses is kept for compatibility but is NOT used
// to restrict teacher viewing.
// ----------------------------------------------------------
function setupTeacherUsersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Teacher_Users');

  if (!sheet) {
    sheet = ss.insertSheet('Teacher_Users');
    sheet.appendRow([
      'Username',
      'PasswordHash',
      'Role',
      'Name',
      'AllowedClasses',
      'Active',
      'CreatedAt'
    ]);
    sheet.getRange(1,1,1,7).setFontWeight('bold');
  }

  Logger.log('Teacher_Users is ready.');
}

function createTeacherUserDirect() {
  var username = 'teacher01';
  var password = '123456';
  var role = 'teacher';
  var name = 'គ្រូ សុភា';
  var allowedClasses = 'ALL';

  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('Teacher_Users');

  if (!sheet) {
    throw new Error('រកមិនឃើញ Sheet Teacher_Users');
  }

  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (
      String(values[i][0]).trim().toLowerCase() ===
      username.toLowerCase()
    ) {
      throw new Error('Username នេះមានរួចហើយ: ' + username);
    }
  }

  sheet.appendRow([
    username,
    teacherPortalHash_(password),
    role,
    name,
    allowedClasses,
    true,
    new Date()
  ]);

  Logger.log('Teacher account created: ' + username);
}

function createAdminUserDirect() {
  var username = 'admin';
  var password = 'Admin@2026';
  var role = 'admin';
  var name = 'អ្នកគ្រប់គ្រង';
  var allowedClasses = 'ALL';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Teacher_Users');

  // Create Teacher_Users automatically if it does not exist.
  if (!sheet) {
    setupTeacherUsersSheet();
    sheet = ss.getSheetByName('Teacher_Users');
  }

  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (
      String(values[i][0] || '').trim().toLowerCase() ===
      username.toLowerCase()
    ) {
      throw new Error('Username នេះមានរួចហើយ: ' + username);
    }
  }

  sheet.appendRow([
    username,
    teacherPortalHash_(password),
    role,
    name,
    allowedClasses,
    true,
    new Date()
  ]);

  Logger.log('Admin account created: ' + username);
  Logger.log('Initial password: ' + password);
  return {
    success: true,
    username: username,
    password: password,
    role: role,
    name: name
  };
}

// ----------------------------------------------------------
// PASSWORD HASH
// ----------------------------------------------------------
function teacherPortalHash_(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// ----------------------------------------------------------
// USER LOGIN
// ----------------------------------------------------------
function teacherPortalFindUser_(username, password) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('Teacher_Users');

  if (!sheet) return null;

  var values = sheet.getDataRange().getValues();
  var wanted = String(username || '').trim().toLowerCase();
  var hash = teacherPortalHash_(password || '');

  for (var i = 1; i < values.length; i++) {
    var active = values[i][5];

    var isActive =
      active === true ||
      String(active).trim().toLowerCase() === 'true' ||
      String(active).trim() === '1' ||
      String(active).trim().toLowerCase() === 'yes';

    if (
      String(values[i][0] || '').trim().toLowerCase() === wanted &&
      String(values[i][1] || '').trim() === hash &&
      isActive
    ) {
      return {
        username:String(values[i][0]).trim(),
        role:String(values[i][2] || 'teacher').trim().toLowerCase(),
        name:String(values[i][3] || '').trim(),
        allowedClasses:teacherPortalParseClasses_(values[i][4])
      };
    }
  }

  return null;
}

function teacherPortalParseClasses_(value) {
  var text = String(value || '').trim();
  if (!text) return [];

  if (
    text.toLowerCase() === 'all' ||
    text === '*' ||
    text.toLowerCase() === 'all classes'
  ) {
    return ['ALL'];
  }

  return text
    .split(',')
    .map(function(x) {
      return String(x).trim();
    })
    .filter(Boolean);
}

function teacherPortalPublicUser_(session) {
  return {
    username:session.username,
    role:session.role,
    name:session.name,
    allowedClasses:['ALL']
  };
}

// ----------------------------------------------------------
// LOGIN / SESSION
// ----------------------------------------------------------
function teacherPortalLogin_(username, password) {
  var user = teacherPortalFindUser_(username, password);

  if (!user) {
    return {
      success:false,
      message:'ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវ!'
    };
  }

  var token =
    Utilities.getUuid().replace(/-/g,'') +
    Utilities.getUuid().replace(/-/g,'');

  var session = {
    username:user.username,
    role:user.role,
    name:user.name,
    allowedClasses:['ALL'],
    createdAt:new Date().getTime()
  };

  CacheService.getScriptCache().put(
    'TP_SESSION_' + token,
    JSON.stringify(session),
    TP_SESSION_TTL
  );

  return {
    success:true,
    token:token,
    user:teacherPortalPublicUser_(session)
  };
}

function teacherPortalGetSession_(token) {
  token = String(token || '').trim();
  if (!token) return null;

  var raw = CacheService
    .getScriptCache()
    .get('TP_SESSION_' + token);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ----------------------------------------------------------
// ACCESS CONTROL
// ----------------------------------------------------------
// IMPORTANT:
// Every active teacher can view ALL classes.
// Admin also can view ALL classes.
// ----------------------------------------------------------
function teacherPortalIsAdmin_(session) {
  return session &&
    String(session.role || '').toLowerCase() === 'admin';
}

function teacherPortalCanAccessClass_(session, className) {
  if (!session) return false;

  // User requested that all teachers can view all classes.
  var role = String(session.role || '').toLowerCase();

  if (role === 'teacher' || role === 'admin') {
    return true;
  }

  return false;
}

// ----------------------------------------------------------
// SHEET HELPERS
// ----------------------------------------------------------
function tpGetStudentSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Students_Payment');

  if (!sheet) {
    throw new Error('រកមិនឃើញ Sheet "Students_Payment"');
  }

  return sheet;
}

function tpGetTable_() {
  var sheet = tpGetStudentSheet_();
  var values = sheet.getDataRange().getValues();

  if (!values || values.length < 1) {
    return {
      sheet:sheet,
      headers:[],
      rows:[]
    };
  }

  return {
    sheet:sheet,
    headers:values[0] || [],
    rows:values.slice(1)
  };
}

function tpNormalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g,'')
    .replace(/[_\-\/\(\)\[\]\.]/g,'');
}

function tpFindHeader_(headers, keywords, fallback) {
  var normalized = headers.map(tpNormalizeHeader_);

  for (var k = 0; k < keywords.length; k++) {
    var key = tpNormalizeHeader_(keywords[k]);
    if (!key) continue;

    for (var i = 0; i < normalized.length; i++) {
      if (
        normalized[i] === key ||
        normalized[i].indexOf(key) !== -1
      ) {
        return i;
      }
    }
  }

  return (
    typeof fallback === 'number' &&
    fallback >= 0 &&
    fallback < headers.length
  ) ? fallback : -1;
}

function tpNumber_(value) {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  var text = String(value || '')
    .replace(/,/g,'')
    .replace(/\s/g,'')
    .replace(/[៛$]/g,'');

  var n = Number(text);
  return isNaN(n) ? 0 : n;
}

function tpText_(value) {
  return String(value == null ? '' : value).trim();
}

function tpDateString_(value) {
  if (!value) return '-';

  try {
    if (value instanceof Date) {
      return Utilities.formatDate(
        value,
        Session.getScriptTimeZone() || 'Asia/Phnom_Penh',
        'dd/MM/yyyy'
      );
    }

    return String(value).split(' ')[0];
  } catch (e) {
    return String(value);
  }
}

function tpIsFemale_(value) {
  var text = String(value || '').trim().toLowerCase();

  return (
    text === 'ស្រី' ||
    text === 'female' ||
    text === 'f' ||
    text === 'ស'
  );
}

function tpFindIndexes_(headers) {
  return {
    id:tpFindHeader_(headers, [
      'studentid','student id','id','code','studentcode',
      'លេខកូដសិស្ស','កូដសិស្ស','កូដ'
    ], 0),

    name:tpFindHeader_(headers, [
      'studentname','student name','name',
      'ឈ្មោះសិស្ស','ឈ្មោះ'
    ], 1),

    gender:tpFindHeader_(headers, [
      'gender','sex','ភេទ'
    ], 2),

    class:tpFindHeader_(headers, [
      'classname','class','grade','ថ្នាក់រៀន','ថ្នាក់'
    ], 3),

    fee:tpFindHeader_(headers, [
      'schoolfee','school fees','fullfee','full fee',
      'annualfee','annual fee','fee','សាលាថ្លៃ',
      'ថ្លៃសិក្សា','ថ្លៃសិក្សាសរុប','សរុប'
    ], 4),

    amount:tpFindHeader_(headers, [
      'amount','paidamount','paid amount','payment',
      'firstpayment','totalpaid','paid','បង់រួច',
      'ប្រាក់បានបង់','ទឹកប្រាក់បង់'
    ], 6),

    date:tpFindHeader_(headers, [
      'date','paymentdate','firstdate','កាលបរិច្ឆេទ',
      'ថ្ងៃបង់','កាលបរិច្ឆេទបង់'
    ], 5),

    phone:tpFindHeader_(headers, [
      'phonenumber','phone number','phone','tel',
      'telephone','ទូរសព្ទ','លេខទូរសព្ទ'
    ], 7),

    type:tpFindHeader_(headers, [
      'type','paymenttype','studenttype','ប្រភេទ'
    ], -1),

    status:tpFindHeader_(headers, [
      'status','ស្ថានភាព'
    ], -1)
  };
}

// ----------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------
function teacherPortalDashboard_(session) {
  var table = tpGetTable_();
  var idx = tpFindIndexes_(table.headers);

  var totalStudents = 0;
  var totalFemale = 0;
  var collected = 0;
  var remaining = 0;
  var pending = 0;

  for (var i = 0; i < table.rows.length; i++) {
    var row = table.rows[i];

    var id = idx.id >= 0 ? tpText_(row[idx.id]) : '';
    if (!id) continue;

    var cls = idx.class >= 0 ? tpText_(row[idx.class]) : '';
    if (!teacherPortalCanAccessClass_(session, cls)) continue;

    var gender = idx.gender >= 0 ? tpText_(row[idx.gender]) : '';
    var paid = idx.amount >= 0 ? tpNumber_(row[idx.amount]) : 0;
    var fee = idx.fee >= 0 ? tpNumber_(row[idx.fee]) : 0;

    // If fee is missing/0, use paid as a safe fallback.
    if (fee < 0) fee = 0;

    var rem = Math.max(0, fee - paid);

    totalStudents++;

    if (tpIsFemale_(gender)) {
      totalFemale++;
    }

    collected += paid;
    remaining += rem;

    if (rem > 0) {
      pending++;
    }
  }

  return {
    totalPaidStudents:totalStudents,
    totalFemalePaid:totalFemale,
    pendingStudentsCount:pending,
    totalCollected:collected,
    totalRemaining:remaining,
    percentage:remaining + collected > 0
      ? Math.round((collected / (remaining + collected)) * 100)
      : 0
  };
}

// ----------------------------------------------------------
// ALL CLASS DATA
// ----------------------------------------------------------
function teacherPortalClasses_(session) {
  var table = tpGetTable_();
  var idx = tpFindIndexes_(table.headers);

  var groups = {};

  for (var i = 0; i < table.rows.length; i++) {
    var row = table.rows[i];

    var id = idx.id >= 0 ? tpText_(row[idx.id]) : '';
    if (!id) continue;

    var cls = idx.class >= 0
      ? tpText_(row[idx.class])
      : '';

    if (!cls) cls = 'មិនកំណត់';

    if (!teacherPortalCanAccessClass_(session, cls)) continue;

    var name = idx.name >= 0 ? tpText_(row[idx.name]) : '';
    var gender = idx.gender >= 0 ? tpText_(row[idx.gender]) : '';
    var paid = idx.amount >= 0 ? tpNumber_(row[idx.amount]) : 0;
    var fee = idx.fee >= 0 ? tpNumber_(row[idx.fee]) : 0;

    if (fee < 0) fee = 0;

    var rem = Math.max(0, fee - paid);

    var status = rem <= 0
      ? 'Paid'
      : 'Pending';

    if (idx.status >= 0 && tpText_(row[idx.status])) {
      status = tpText_(row[idx.status]);
    }

    var date = idx.date >= 0
      ? tpDateString_(row[idx.date])
      : '-';

    var phone = idx.phone >= 0
      ? tpText_(row[idx.phone])
      : '';

    var type = idx.type >= 0
      ? tpText_(row[idx.type])
      : '';

    if (!groups[cls]) {
      groups[cls] = [];
    }

    groups[cls].push({
      id:id,
      name:name,
      gender:gender,
      className:cls,
      status:status,
      fullFee:fee,
      paidAmt:paid,
      remaining:rem,
      date:date,
      phone:phone,
      type:type
    });
  }

  return groups;
}

// ----------------------------------------------------------
// STUDENT SEARCH
// ----------------------------------------------------------
function teacherPortalStudent_(session, studentId) {
  var wanted = tpText_(studentId);

  if (!wanted) {
    throw new Error('សូមបញ្ចូលលេខកូដសិស្ស។');
  }

  var table = tpGetTable_();
  var idx = tpFindIndexes_(table.headers);

  for (var i = 0; i < table.rows.length; i++) {
    var row = table.rows[i];

    var id = idx.id >= 0 ? tpText_(row[idx.id]) : '';

    if (!id) continue;

    if (id.toLowerCase() !== wanted.toLowerCase()) {
      continue;
    }

    var cls = idx.class >= 0 ? tpText_(row[idx.class]) : '';

    if (!teacherPortalCanAccessClass_(session, cls)) {
      throw new Error('អ្នកគ្មានសិទ្ធិមើលសិស្សក្នុងថ្នាក់នេះទេ។');
    }

    var name = idx.name >= 0 ? tpText_(row[idx.name]) : '';
    var gender = idx.gender >= 0 ? tpText_(row[idx.gender]) : '';
    var paid = idx.amount >= 0 ? tpNumber_(row[idx.amount]) : 0;
    var fee = idx.fee >= 0 ? tpNumber_(row[idx.fee]) : 0;
    var rem = Math.max(0, fee - paid);

    return {
      id:id,
      name:name,
      gender:gender,
      class:cls,
      type:idx.type >= 0 ? tpText_(row[idx.type]) : '',
      fullFee:fee,
      amount:paid,
      remaining:rem,
      phone:idx.phone >= 0 ? tpText_(row[idx.phone]) : '',
      date:idx.date >= 0 ? tpDateString_(row[idx.date]) : '-'
    };
  }

  return null;
}

// ----------------------------------------------------------
// PAYMENT HISTORY
// ----------------------------------------------------------
function teacherPortalHistory_(session, studentId) {
  // Verify that the student exists and is accessible first.
  var student = teacherPortalStudent_(session, studentId);

  if (!student) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Payment_History');

  if (!sheet) {
    return [];
  }

  var values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return [];
  }

  var headers = values[0] || [];

  var idxId = tpFindHeader_(headers, [
    'studentid','student id','id','code',
    'លេខកូដសិស្ស','កូដសិស្ស','កូដ'
  ], 0);

  var idxDate = tpFindHeader_(headers, [
    'date','paymentdate','កាលបរិច្ឆេទ','ថ្ងៃបង់'
  ], 1);

  var idxPhase = tpFindHeader_(headers, [
    'phase','paymentphase','payment type','type',
    'ដំណាក់កាល','លើក'
  ], 2);

  var idxAmount = tpFindHeader_(headers, [
    'amount','paidamount','payment','ទឹកប្រាក់','បង់រួច'
  ], 3);

  var result = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];

    var id = idxId >= 0 ? tpText_(row[idxId]) : '';

    if (
      id &&
      id.toLowerCase() ===
      String(student.id).toLowerCase()
    ) {
      result.push({
        date:idxDate >= 0 ? tpDateString_(row[idxDate]) : '-',
        phase:idxPhase >= 0 ? tpText_(row[idxPhase]) : 'Payment',
        amount:idxAmount >= 0 ? tpNumber_(row[idxAmount]) : 0
      });
    }
  }

  return result;
}


// ==========================================================
// PHASE 3B — ADMIN PORTAL
// IMPORTANT: This version DOES NOT use Teacher 80% / School 20%.
// Data source: Students_Payment + Payment_History
// Students_Payment current structure (from the old project):
// 1 ID, 2 Name, 3 Class, 4 Payment Type, 5 Amount, 6 Method,
// 7 CreatedAt, 8 Status, 9 Cashier, 10 Other, 11 Gender,
// 12 School Year, 13 Full Year Fee, 14 Remaining, 15 Phone.
// Payment_History: Student ID, Student Name, Date, Phase, Amount, Method, Cashier.
// ==========================================================

function adminPortalFindSheet_(wanted) {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var exact=ss.getSheetByName(wanted);
  if(exact) return exact;
  var target=String(wanted).trim().toLowerCase();
  var sheets=ss.getSheets();
  for(var i=0;i<sheets.length;i++){
    if(String(sheets[i].getName()).trim().toLowerCase()===target) return sheets[i];
  }
  return null;
}

function adminPortalSheet_() {
  var sh = adminPortalFindSheet_('Students_Payment');
  if (!sh) throw new Error('រកមិនឃើញ Sheet Students_Payment');
  return sh;
}

function adminPortalHistorySheet_() {
  return adminPortalFindSheet_('Payment_History');
}

// Read the real used range instead of relying on getDataRange().
// This is intentionally tolerant of extra columns / formatting in the sheets.
function adminPortalReadRows_(sh, minCols) {
  if (!sh) return [];
  SpreadsheetApp.flush();
  var maxRows = sh.getMaxRows();
  var lastCol = Math.max(minCols || 1, sh.getLastColumn());
  if (maxRows < 1) return [];

  // Do not trust getLastRow() alone. A row can contain a newly written value
  // while the sheet's used-range metadata is not updated yet. Read the actual
  // grid and trim only rows that are completely empty.
  var values = sh.getRange(1, 1, maxRows, lastCol).getValues();
  var lastDataRow = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    var hasData = false;
    for (var j = 0; j < lastCol; j++) {
      if (values[i][j] !== '' && values[i][j] !== null) { hasData = true; break; }
    }
    if (hasData) { lastDataRow = i + 1; break; }
  }
  return lastDataRow > 0 ? values.slice(0, lastDataRow) : [];
}

function adminPortalReadDisplayRows_(sh, minCols) {
  if (!sh) return [];
  var maxRows = sh.getMaxRows();
  var lastCol = Math.max(minCols || 1, sh.getLastColumn());
  if (maxRows < 1) return [];
  var values = sh.getRange(1, 1, maxRows, lastCol).getDisplayValues();
  var lastDataRow = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    var hasData = false;
    for (var j = 0; j < lastCol; j++) {
      if (String(values[i][j] || '').trim() !== '') { hasData = true; break; }
    }
    if (hasData) { lastDataRow = i + 1; break; }
  }
  return lastDataRow > 0 ? values.slice(0, lastDataRow) : [];
}

function adminPortalNormalizeId_(v) {
  return adminPortalText_(v).replace(/\u00a0/g, ' ').trim();
}

function adminPortalText_(v) { return String(v == null ? '' : v).trim(); }
function adminPortalNum_(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  var s = String(v || '').replace(/[៛$]/g,'').replace(/,/g,'').replace(/\s/g,'');
  var kh={'០':'0','១':'1','២':'2','៣':'3','៤':'4','៥':'5','៦':'6','៧':'7','៨':'8','៩':'9'};
  s=s.replace(/[០-៩]/g,function(x){return kh[x]||x;});
  var n=Number(s); return isNaN(n)?0:n;
}
function adminPortalDate_(v) {
  if (!v) return '';
  try {
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Phnom_Penh','yyyy-MM-dd HH:mm:ss');
    return String(v);
  } catch(e) { return String(v); }
}
function adminPortalFemale_(v) {
  var s=adminPortalText_(v).toLowerCase();
  return s==='ស្រី'||s==='female'||s==='f'||s==='ស';
}

function adminPortalStudentObject_(r) {
  return {
    id:adminPortalText_(r[0]), name:adminPortalText_(r[1]), className:adminPortalText_(r[2]),
    paymentType:adminPortalText_(r[3]), amount:adminPortalNum_(r[4]), method:adminPortalText_(r[5]),
    createdAt:adminPortalDate_(r[6]), status:adminPortalText_(r[7]), cashier:adminPortalText_(r[8]),
    other:adminPortalText_(r[9]), gender:adminPortalText_(r[10]), schoolYear:adminPortalText_(r[11]),
    fullFee:adminPortalNum_(r[12]), remaining:adminPortalNum_(r[13]), phone:adminPortalText_(r[14])
  };
}

function adminPortalDashboard_() {
  var sh=adminPortalSheet_(), values=adminPortalReadRows_(sh,15);
  var students=[], seen={};
  var total=0,female=0,collected=0,remaining=0,paid=0,pending=0,exempted=0,cash=0,qr=0;
  var classStats={}, teacherStats={};
  for(var i=1;i<values.length;i++){
    var r=values[i], id=adminPortalNormalizeId_(r[0]); if(!id) continue;
    var status=adminPortalText_(r[7]); if(status.toLowerCase()==='archived') continue;
    var s=adminPortalStudentObject_(r); total++;
    if(adminPortalFemale_(s.gender)) female++;
    collected+=s.amount; remaining+=s.remaining;
    if(s.remaining<=0){paid++;}else{pending++;}
    if(s.other.indexOf('លើកលែង')>=0) exempted++;
    if(s.method.toUpperCase()==='QR') qr+=s.amount; else if(s.method) cash+=s.amount;
    var ck=s.className||'មិនកំណត់';
    if(!classStats[ck]) classStats[ck]={className:ck,total:0,female:0,paid:0,pending:0,collected:0,remaining:0};
    classStats[ck].total++; classStats[ck].female+=adminPortalFemale_(s.gender)?1:0;
    classStats[ck].paid+=s.remaining<=0?1:0; classStats[ck].pending+=s.remaining>0?1:0;
    classStats[ck].collected+=s.amount; classStats[ck].remaining+=s.remaining;
    var teacher=adminPortalText_(r[8]);
    if(teacher){ if(!teacherStats[teacher]) teacherStats[teacher]={name:teacher,total:0,collected:0}; teacherStats[teacher].total++; teacherStats[teacher].collected+=s.amount; }
  }
  return {
    totalStudents:total,totalFemale:female,totalMale:Math.max(0,total-female),
    collected:collected,remaining:remaining,paidStudents:paid,pendingStudents:pending,
    exemptedStudents:exempted,cash:cash,qr:qr,
    progress:(collected+remaining)>0?Math.round(collected/(collected+remaining)*100):0,
    classes:Object.keys(classStats).map(function(k){return classStats[k];}).sort(function(a,b){return a.className.localeCompare(b.className,'km');}),
    teachers:Object.keys(teacherStats).map(function(k){return teacherStats[k];}).sort(function(a,b){return a.name.localeCompare(b.name,'km');})
  };
}

function adminPortalStudents_(filters) {
  filters=filters||{}; var sh=adminPortalSheet_(), values=adminPortalReadRows_(sh,15), out=[];
  var q=adminPortalText_(filters.search).toLowerCase(), cls=adminPortalText_(filters.className).toLowerCase(), st=adminPortalText_(filters.status).toLowerCase();
  for(var i=1;i<values.length;i++){
    var r=values[i], id=adminPortalNormalizeId_(r[0]); if(!id) continue;
    var s=adminPortalStudentObject_(r); if(s.status.toLowerCase()==='archived' && st!=='archived') continue;
    if(cls && s.className.toLowerCase()!==cls) continue;
    if(st && s.status.toLowerCase()!==st) continue;
    if(q){var hay=[s.id,s.name,s.phone,s.className,s.schoolYear,s.paymentType].join(' ').toLowerCase(); if(hay.indexOf(q)<0) continue;}
    s.rowNumber=i+1; out.push(s);
  }
  out.sort(function(a,b){return a.name.localeCompare(b.name,'km');});
  return {rows:out,sourceRows:Math.max(0,values.length-1),lastStudent:out.length?out[out.length-1].id:'',classes:[].concat(Object.keys(out.reduce(function(m,s){m[s.className||'មិនកំណត់']=1;return m;},{}))).sort(function(a,b){return a.localeCompare(b,'km');})};
}

function adminPortalStudent_(id) {
  id=adminPortalText_(id); if(!id) return null;
  var sh=adminPortalSheet_(), values=adminPortalReadRows_(sh,15);
  for(var i=1;i<values.length;i++) if(adminPortalNormalizeId_(values[i][0])===id){
    var s=adminPortalStudentObject_(values[i]); s.rowNumber=i+1; s.history=adminPortalPayments_({studentId:id}).rows; return s;
  }
  return null;
}

function adminPortalNormalizePaymentMethod_(v) {
  var s=adminPortalText_(v).toLowerCase();
  return (s.indexOf('qr')>=0 || s.indexOf('khqr')>=0 || s.indexOf('ស្កេ')>=0) ? 'QR' : 'Cash';
}

/* ----------------------------------------------------------
   STUDENT ID GENERATOR
   Fix: the previous V2 backend called generateNextStudentId()
   but that function was not defined in the combined backend.
   This version generates the next AKKNGS-###### ID directly
   from Students_Payment and guarantees it is unused.
---------------------------------------------------------- */
function generateNextStudentId() {
  var sh = adminPortalSheet_();
  var values = adminPortalReadRows_(sh, 15);
  var maxNo = 0;

  for (var i = 1; i < values.length; i++) {
    var id = adminPortalText_(values[i][0]);
    if (!id) continue;

    // Accept the project's normal format: AKKNGS-000001
    var m = id.match(/^AKKNGS-(\d+)$/i);
    if (m) {
      var n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNo) maxNo = n;
    }
  }

  var candidateNo = maxNo + 1;
  var candidate;

  // Extra collision check in case IDs were manually entered out of sequence.
  var used = {};
  for (var j = 1; j < values.length; j++) {
    var existing = adminPortalText_(values[j][0]).toUpperCase();
    if (existing) used[existing] = true;
  }

  do {
    candidate = 'AKKNGS-' + String(candidateNo).padStart(6, '0');
    candidateNo++;
  } while (used[candidate]);

  return candidate;
}


function adminPortalSaveStudent_(p, session) {
  p=p||{};
  var sh=adminPortalSheet_(), values=adminPortalReadRows_(sh,15);
  var id=adminPortalText_(p.id), rowIndex=-1, isNew=false;
  if(id){
    for(var i=1;i<values.length;i++){
      if(adminPortalNormalizeId_(values[i][0])===id){rowIndex=i+1;break;}
    }
  }
  if(rowIndex<0){ id=id||generateNextStudentId(); rowIndex=Math.max(2,values.length+1); isNew=true; }

  var old=rowIndex<=values.length?values[rowIndex-1]:new Array(15).fill('');
  var row=old.slice(0,15); while(row.length<15) row.push('');
  var name=adminPortalText_(p.name);
  var fullFee=adminPortalNum_(p.fullFee);
  var amount=adminPortalNum_(p.amount);
  var method=adminPortalNormalizePaymentMethod_(p.method);
  var cashier=adminPortalText_(p.cashier||session&&session.name||'Admin');
  var phase=adminPortalText_(p.paymentType||'១ឆមាស');
  var other=adminPortalText_(p.other||'ធម្មតា');

  row[0]=id;
  row[1]=name;
  row[2]=adminPortalText_(p.className);
  row[3]=phase||row[3];
  row[9]=other;
  row[10]=adminPortalText_(p.gender||row[10]);
  row[11]=adminPortalText_(p.schoolYear||row[11]||'2026-2027');
  row[12]=fullFee;
  row[14]=adminPortalText_(p.phone);

  if(isNew){
    amount=Math.max(0,Math.min(amount,fullFee));
    row[4]=amount;
    row[5]=method;
    row[6]=new Date();
    row[7]=Math.max(0,fullFee-amount)>0?'Pending':'Paid';
    row[8]=cashier;
    row[13]=Math.max(0,fullFee-amount);
    sh.getRange(rowIndex,1,1,15).setValues([row]);

    // IMPORTANT: Like the old form, an actual initial payment is also written
    // to Payment_History. A zero-amount registration is not a fake payment row.
    if(amount>0){
      var hs=adminPortalHistorySheet_();
      if(!hs) throw new Error('រកមិនឃើញ Payment_History');
      hs.appendRow([id,name,new Date(),phase,amount,method,cashier]);
    }
  } else {
    // Editing student information must NOT create a duplicate payment history.
    // Keep the existing paid amount and payment totals intact.
    var existingAmount=adminPortalNum_(row[4]);
    row[4]=existingAmount;
    row[5]=adminPortalNormalizePaymentMethod_(row[5]);
    row[13]=Math.max(0,fullFee-existingAmount);
    row[7]=row[13]>0?'Pending':'Paid';
    sh.getRange(rowIndex,1,1,15).setValues([row]);
  }

  SpreadsheetApp.flush();
  return {success:true,message:isNew?'បានបន្ថែមសិស្ស និងកត់ត្រាការបង់ប្រាក់រួចរាល់':'បានកែប្រែព័ត៌មានសិស្សរួចរាល់',student:adminPortalStudent_(id)};
}

function adminPortalArchiveStudent_(id) {
  id=adminPortalNormalizeId_(id); var sh=adminPortalSheet_(), values=adminPortalReadRows_(sh,15);
  for(var i=1;i<values.length;i++) if(adminPortalNormalizeId_(values[i][0])===id){ sh.getRange(i+1,8).setValue('Archived'); return {success:true,message:'បាន Archive សិស្សរួចរាល់'}; }
  throw new Error('រកមិនឃើញសិស្ស');
}

function adminPortalPayments_(filters) {
  filters=filters||{};
  var sh=adminPortalHistorySheet_();
  if(!sh) return {rows:[],totalAmount:0,cash:0,qr:0,sourceRows:0};

  var values=adminPortalReadRows_(sh,7), display=adminPortalReadDisplayRows_(sh,7), out=[];
  var q=adminPortalText_(filters.search).toLowerCase();
  var method=adminPortalText_(filters.method).toLowerCase();

  for(var i=1;i<values.length;i++){
    var r=values[i], d=display[i]||r;
    var id=adminPortalNormalizeId_(r[0]);
    if(!id) continue;

    var x={
      rowNumber:i+1,
      studentId:id,
      studentName:adminPortalText_(r[1]),
      date:adminPortalDate_(r[2]),
      dateDisplay:adminPortalText_(d[2]),
      phase:adminPortalText_(r[3]),
      amount:adminPortalNum_(r[4]),
      method:adminPortalText_(r[5])||'Cash',
      cashier:adminPortalText_(r[6])
    };

    if(filters.studentId && id!==adminPortalNormalizeId_(filters.studentId)) continue;
    if(method && x.method.toLowerCase()!==method) continue;
    if(q && [x.studentId,x.studentName,x.phase,x.cashier,x.method,x.dateDisplay].join(' ').toLowerCase().indexOf(q)<0) continue;
    out.push(x);
  }

  out.sort(function(a,b){return b.rowNumber-a.rowNumber;});
  return {
    rows:out,
    totalAmount:out.reduce(function(t,x){return t+x.amount;},0),
    cash:out.filter(function(x){return x.method.toUpperCase()==='CASH';}).reduce(function(t,x){return t+x.amount;},0),
    qr:out.filter(function(x){return x.method.toUpperCase()==='QR';}).reduce(function(t,x){return t+x.amount;},0),
    sourceRows:Math.max(0,values.length-1)
  };
}
function adminPortalSavePayment_(p, session) {
  p=p||{}; var sh=adminPortalSheet_(), hs=adminPortalHistorySheet_(); if(!hs) throw new Error('រកមិនឃើញ Payment_History');
  var studentId=adminPortalText_(p.studentId); if(!studentId) throw new Error('Student ID ត្រូវបានទាមទារ');
  var amount=adminPortalNum_(p.amount); if(amount<=0) throw new Error('ចំនួនប្រាក់ត្រូវធំជាង 0');
  var method=adminPortalNormalizePaymentMethod_(p.method||'Cash');
  var date=p.date?new Date(p.date):new Date(); if(isNaN(date.getTime())) date=new Date();
  var phase=adminPortalText_(p.phase||'ការបង់ប្រាក់'); var cashier=adminPortalText_(p.cashier||session&&session.name||'Admin');
  var values=adminPortalReadRows_(sh,15), studentRow=-1;
  for(var i=1;i<values.length;i++) if(adminPortalNormalizeId_(values[i][0])===studentId){studentRow=i+1;break;}
  if(studentRow<0) throw new Error('រកមិនឃើញសិស្ស: '+studentId);
  var oldHistoryAmount=0, histRow=Number(p.rowNumber||0);
  if(histRow>=2 && histRow<=hs.getLastRow()){
    var oldHist=hs.getRange(histRow,1,1,7).getValues()[0];
    if(adminPortalText_(oldHist[0])!==studentId) throw new Error('Payment record មិនត្រូវនឹងសិស្ស');
    oldHistoryAmount=adminPortalNum_(oldHist[4]);
    hs.getRange(histRow,1,1,7).setValues([[studentId,adminPortalText_(p.studentName),date,phase,amount,method,cashier]]);
  } else {
    hs.appendRow([studentId,adminPortalText_(p.studentName),date,phase,amount,method,cashier]);
  }
  var row=sh.getRange(studentRow,1,1,15).getValues()[0];
  var current=adminPortalNum_(row[4]); var newAmount=Math.max(0,current-oldHistoryAmount+amount); row[4]=newAmount; row[3]=phase.indexOf('២')>=0?'១ឆ្នាំពេញ':row[3]||phase;
  row[5]=method; row[6]=row[6]||new Date(); row[7]=Math.max(0,adminPortalNum_(row[12])-newAmount)>0?'Pending':'Paid'; row[8]=cashier; row[13]=Math.max(0,adminPortalNum_(row[12])-newAmount);
  sh.getRange(studentRow,1,1,15).setValues([row]);
  return {success:true,message:histRow>=2?'បានកែប្រែការបង់ប្រាក់រួចរាល់':'បានបន្ថែមការបង់ប្រាក់រួចរាល់'};
}

function adminPortalDeletePayment_(rowNumber) {
  var hs=adminPortalHistorySheet_(); if(!hs) throw new Error('រកមិនឃើញ Payment_History');
  var rn=Number(rowNumber); if(rn<2||rn>hs.getLastRow()) throw new Error('Payment record មិនត្រឹមត្រូវ');
  var old=hs.getRange(rn,1,1,7).getValues()[0], studentId=adminPortalText_(old[0]), oldAmount=adminPortalNum_(old[4]);
  hs.deleteRow(rn);
  var sh=adminPortalSheet_(), values=adminPortalReadRows_(sh,15);
  for(var i=1;i<values.length;i++) if(adminPortalNormalizeId_(values[i][0])===studentId){
    var row=values[i].slice(); var newAmount=Math.max(0,adminPortalNum_(row[4])-oldAmount); row[4]=newAmount; row[13]=Math.max(0,adminPortalNum_(row[12])-newAmount); row[7]=row[13]>0?'Pending':'Paid'; sh.getRange(i+1,1,1,15).setValues([row]); break;
  }
  return {success:true,message:'បានលុបប្រវត្តិបង់ប្រាក់រួចរាល់'};
}

function adminPortalDataHealth_(query) {
  SpreadsheetApp.flush();
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var students=adminPortalFindSheet_('Students_Payment');
  var history=adminPortalFindSheet_('Payment_History');
  var sv=students?adminPortalReadRows_(students,15):[];
  var hv=history?adminPortalReadRows_(history,7):[];
  var lastStudentId='';
  if(sv.length>1){for(var i=sv.length-1;i>=1;i--){if(adminPortalNormalizeId_(sv[i][0])){lastStudentId=adminPortalNormalizeId_(sv[i][0]);break;}}}
  var q=adminPortalText_(query||'');
  var matches=[];
  if(q){
    var sheets=ss.getSheets();
    for(var si=0;si<sheets.length;si++){
      var sh=sheets[si], vals=adminPortalReadRows_(sh,2);
      for(var ri=1;ri<vals.length;ri++){
        var id=adminPortalText_(vals[ri][0]), name=adminPortalText_(vals[ri][1]);
        if((id+' '+name).toLowerCase().indexOf(q.toLowerCase())>=0){
          matches.push({sheet:sh.getName(),row:ri+1,id:id,name:name});
          if(matches.length>=20) break;
        }
      }
      if(matches.length>=20) break;
    }
  }
  return {
    studentsSheetFound:!!students,
    historySheetFound:!!history,
    studentRows:Math.max(0,sv.length-1),
    historyRows:Math.max(0,hv.length-1),
    lastStudentId:lastStudentId,
    lastHistoryStudentId:hv.length>1?adminPortalNormalizeId_(hv[hv.length-1][0]):'',
    studentLastRow:students?students.getLastRow():0,
    studentMaxRows:students?students.getMaxRows():0,
    historyLastRow:history?history.getLastRow():0,
    historyMaxRows:history?history.getMaxRows():0,
    query:q,
    matches:matches
  };
}

function adminPortalTeachers_() {
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
  if(!sh) return [];
  var v=sh.getDataRange().getValues(); if(v.length<2) return [];
  var h=v[0].map(function(x){return String(x).trim();});
  function idx(names){for(var i=0;i<h.length;i++)for(var j=0;j<names.length;j++)if(h[i].toLowerCase()===names[j].toLowerCase())return i;return -1;}
  var ni=idx(['teacher_name','name','ឈ្មោះ']), gi=idx(['gender','sex','ភេទ']), ti=idx(['teacher_id','id']), si=idx(['status','ស្ថានភាព']);
  return v.slice(1).filter(function(r){return ni>=0&&adminPortalText_(r[ni]);}).map(function(r){return {teacher_id:ti>=0?adminPortalText_(r[ti]):'',teacher_name:ni>=0?adminPortalText_(r[ni]):'',gender:gi>=0?adminPortalText_(r[gi]):'',status:si>=0?adminPortalText_(r[si]):'Active'};});
}

function adminPortalUsers_() {
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teacher_Users'); if(!sh) return [];
  var v=sh.getDataRange().getValues(); if(v.length<2) return [];
  return v.slice(1).filter(function(r){return adminPortalText_(r[0]);}).map(function(r){return {username:adminPortalText_(r[0]),role:adminPortalText_(r[2])||'teacher',name:adminPortalText_(r[3]),allowedClasses:adminPortalText_(r[4])||'ALL',active:r[5]===true||String(r[5]).toLowerCase()==='true'||String(r[5])==='1',createdAt:adminPortalDate_(r[6])};});
}

function adminPortalSaveUser_(p) {
  p=p||{}; var username=adminPortalText_(p.username); if(!username) throw new Error('Username ត្រូវបានទាមទារ');
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teacher_Users'); if(!sh) throw new Error('រកមិនឃើញ Teacher_Users');
  var v=sh.getDataRange().getValues(), row=-1; for(var i=1;i<v.length;i++) if(adminPortalText_(v[i][0]).toLowerCase()===username.toLowerCase()){row=i+1;break;}
  var password=String(p.password||'');
  if(row<0){if(!password) throw new Error('Account ថ្មីត្រូវការលេខសម្ងាត់'); sh.appendRow([username,teacherPortalHash_(password),adminPortalText_(p.role||'teacher').toLowerCase(),adminPortalText_(p.name),adminPortalText_(p.allowedClasses||'ALL'),p.active!==false,new Date()]);}
  else {if(password) sh.getRange(row,2).setValue(teacherPortalHash_(password)); sh.getRange(row,3,1,4).setValues([[adminPortalText_(p.role||v[row-1][2]).toLowerCase(),adminPortalText_(p.name||v[row-1][3]),adminPortalText_(p.allowedClasses||v[row-1][4]||'ALL'),p.active!==false]]);}
  return {success:true,message:'បានរក្សាទុក Account រួចរាល់'};
}

function adminPortalToggleUser_(username, active) {
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teacher_Users'); if(!sh) throw new Error('រកមិនឃើញ Teacher_Users');
  var v=sh.getDataRange().getValues(); for(var i=1;i<v.length;i++) if(adminPortalText_(v[i][0]).toLowerCase()===adminPortalText_(username).toLowerCase()){sh.getRange(i+1,6).setValue(active===true||String(active).toLowerCase()==='true');return {success:true,message:'បានប្តូរស្ថានភាព Account រួចរាល់'};}
  throw new Error('រកមិនឃើញ Account');
}

function adminPortalExportCsv_(filters) {
  var students=adminPortalStudents_(filters||{}).rows;
  var lines=['Student ID,Student Name,Gender,Class,Payment Type,Amount,Status,School Year,Full Fee,Remaining,Phone,Payment Method'];
  students.forEach(function(s){lines.push([s.id,s.name,s.gender,s.className,s.paymentType,s.amount,s.status,s.schoolYear,s.fullFee,s.remaining,s.phone,s.method].map(function(x){return '"'+String(x==null?'':x).replace(/"/g,'""')+'"';}).join(','));});
  var name='Admin_Students_'+Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Phnom_Penh','yyyyMMdd_HHmmss')+'.csv';
  var file=DriveApp.createFile(name,'\uFEFF'+lines.join('\n'),MimeType.CSV);
  return {success:true,name:name,url:file.getDownloadUrl()};
}


// ==========================================================
// OFFICIAL DAILY / MONTHLY REPORTS
// Source: Payment_History + Students_Payment
// Each student is aggregated once per selected period.
// QR and Cash are separated for official reporting.
// ==========================================================

function adminPortalReportParseDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (v === null || v === undefined || v === '') return null;

  var s = String(v).trim();
  if (!s) return null;

  // ISO / Google Sheets timestamp first.
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // yyyy-mm-dd or yyyy/mm/dd
  var ymd = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymd) {
    return new Date(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3])
    );
  }

  // Cambodian/local display style: dd/mm/yyyy or dd-mm-yyyy.
  var dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy) {
    return new Date(
      Number(dmy[3]),
      Number(dmy[2]) - 1,
      Number(dmy[1])
    );
  }

  return null;
}

function adminPortalReportYmd_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Phnom_Penh', 'yyyy-MM-dd');
}

function adminPortalReportYm_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Phnom_Penh', 'yyyy-MM');
}

function adminPortalBuildReport_(startDate, endDate, periodLabel) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hs = adminPortalFindSheet_('Payment_History');
  var sh = adminPortalFindSheet_('Students_Payment');
  if (!hs) throw new Error('រកមិនឃើញ Sheet Payment_History');
  if (!sh) throw new Error('រកមិនឃើញ Sheet Students_Payment');

  var hv = adminPortalReadRows_(hs, 7);
  var sv = adminPortalReadRows_(sh, 15);

  var students = {};
  for (var i=1;i<sv.length;i++) {
    var sr=sv[i];
    var sid=adminPortalNormalizeId_(sr[0]);
    if (!sid) continue;
    students[sid.toLowerCase()] = {
      id:sid,
      name:adminPortalText_(sr[1]),
      gender:adminPortalText_(sr[10]),
      className:adminPortalText_(sr[2])
    };
  }

  var grouped = {};
  var cashiers = {};
  var qrTotal = 0, cashTotal = 0;

  var reportTz = Session.getScriptTimeZone() || 'Asia/Phnom_Penh';
  var startKey = Utilities.formatDate(startDate, reportTz, 'yyyy-MM-dd');
  var endKey = Utilities.formatDate(endDate, reportTz, 'yyyy-MM-dd');

  for (var j=1;j<hv.length;j++) {
    var r=hv[j];
    var id=adminPortalNormalizeId_(r[0]);
    if (!id) continue;

    var dt=adminPortalReportParseDate_(r[2]);
    if (!dt) continue;

    var rowKey = Utilities.formatDate(dt, reportTz, 'yyyy-MM-dd');

    // Compare calendar dates rather than JavaScript Date boundaries.
    // This avoids timezone shifts for timestamps saved from the web app.
    if (rowKey < startKey || rowKey >= endKey) continue;

    var key=id.toLowerCase();
    var method=adminPortalNormalizePaymentMethod_(r[5]);
    var amount=Math.max(0, adminPortalNum_(r[4]));
    var info=students[key] || {
      id:id,
      name:adminPortalText_(r[1]),
      gender:'',
      className:''
    };

    if (!grouped[key]) {
      grouped[key] = {
        id:info.id,
        name:info.name,
        gender:info.gender,
        className:info.className,
        qr:0,
        cash:0,
        total:0
      };
    }

    if (method === 'QR') {
      grouped[key].qr += amount;
      qrTotal += amount;
    } else {
      grouped[key].cash += amount;
      cashTotal += amount;
    }
    grouped[key].total += amount;

    var cashier=adminPortalText_(r[6]);
    if (cashier) cashiers[cashier]=true;
  }

  var rows=Object.keys(grouped).map(function(k){ return grouped[k]; });
  rows.sort(function(a,b){ return String(a.name).localeCompare(String(b.name),'km'); });

  var femaleCount=rows.filter(function(r){return adminPortalFemale_(r.gender);}).length;

  return {
    period:periodLabel,
    studentCount:rows.length,
    femaleCount:femaleCount,
    total:qrTotal+cashTotal,
    qrTotal:qrTotal,
    cashTotal:cashTotal,
    cashiers:Object.keys(cashiers),
    rows:rows
  };
}

function adminPortalDailyReport_(dateValue) {
  var s=adminPortalText_(dateValue);
  var d;
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    var p=s.split('-');
    d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  } else {
    d=new Date();
  }
  d.setHours(0,0,0,0);
  var end=new Date(d.getTime()+24*60*60*1000);
  return adminPortalBuildReport_(d,end,adminPortalReportYmd_(d));
}

function adminPortalMonthlyReport_(monthValue) {
  var s=adminPortalText_(monthValue);
  var y,m;
  if (/^\d{4}-\d{2}$/.test(s)) {
    var p=s.split('-'); y=Number(p[0]); m=Number(p[1])-1;
  } else {
    var now=new Date(); y=now.getFullYear(); m=now.getMonth();
  }
  var start=new Date(y,m,1); start.setHours(0,0,0,0);
  var end=new Date(y,m+1,1); end.setHours(0,0,0,0);
  return adminPortalBuildReport_(start,end,Utilities.formatDate(start,Session.getScriptTimeZone()||'Asia/Phnom_Penh','yyyy-MM'));
}
