// ============================================================
// TEACHER PORTAL API BRIDGE
// ============================================================
// IMPORTANT:
// 1. Keep your existing backend functions unchanged.
// 2. Replace your current doGet(e) with the doGet below.
// 3. The existing Teacher page will still work at ?page=teacher.
// ============================================================

function doGet(e) {
  e = e || { parameter: {} };
  var p = e.parameter || {};

  // Vercel -> Apps Script JSON API
  if (p.api === 'teacher') {
    return handleTeacherApi_(p);
  }

  // Existing pages
  var page = p.page || 'index';

  if (page === 'cashier') {
    return HtmlService.createHtmlOutputFromFile('Cashier')
      .setTitle('តុបេឡា (Cashier) - សាលាបឋមសិក្សាសម្តេចព្រះរាជអគ្គមហេសី')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else if (page === 'teacher') {
    return HtmlService.createHtmlOutputFromFile('Teacher')
      .setTitle('ប្រព័ន្ធគ្រូបង្រៀន (Teacher) - ពិនិត្យការបង់ប្រាក់')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else if (page === 'reminder') {
    return HtmlService.createHtmlOutputFromFile('Reminder')
      .setTitle('របាយការណ៍សិស្សជំពាក់ប្រាក់ឆមាសទី២')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else if (page === 'semester2') {
    return HtmlService.createHtmlOutputFromFile('Semester2')
      .setTitle('របាយការណ៍ឆមាសទី២ - សាលាបឋមសិក្សាសម្តេចព្រះរាជអគ្គមហេសី')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ផ្ទាំងគ្រប់គ្រងរដ្ឋបាល (Admin Dashboard)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleTeacherApi_(p) {
  try {
    var action = String(p.action || '').trim();
    var result;

    switch (action) {
      case 'dashboard':
        result = getTeacherDashboardData();
        break;

      case 'classes':
        result = getClassMonitoringData();
        break;

      case 'student':
        if (!p.id) return teacherApiJson_(false, null, 'Student ID is required.');
        result = getStudentById(String(p.id).trim());
        break;

      case 'history':
        if (!p.id) return teacherApiJson_(false, null, 'Student ID is required.');
        result = getStudentHistoryLog(String(p.id).trim());
        break;

      default:
        return teacherApiJson_(false, null, 'Invalid teacher API action.');
    }

    return teacherApiJson_(true, result, 'OK');
  } catch (err) {
    console.error(err);
    return teacherApiJson_(false, null, String(err && err.message ? err.message : err));
  }
}

function teacherApiJson_(success, data, message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: success,
      data: data,
      message: message || ''
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
