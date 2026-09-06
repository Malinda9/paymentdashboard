# Teacher Portal — Vercel + Google Apps Script

## រចនាសម្ព័ន្ធ

- `index.html` — Teacher Portal UI
- `api/teacher.js` — Vercel API proxy
- `vercel.json` — Vercel configuration
- `apps-script-teacher-api.gs` — កូដដែលត្រូវបន្ថែម/កែ `doGet()` នៅ Google Apps Script

## 1) Google Apps Script

រក្សា functions ដែលមានស្រាប់ដដែល ជាពិសេស៖

- `getTeacherDashboardData()`
- `getClassMonitoringData()`
- `getStudentById(studentId)`
- `getStudentHistoryLog(studentId)`

ប្តូរ `doGet(e)` ចាស់របស់អ្នកទៅកូដនៅក្នុង `apps-script-teacher-api.gs`។ កូដនោះរក្សា routes `index`, `cashier`, `teacher`, `reminder`, `semester2` ហើយបន្ថែម `?api=teacher&action=...` សម្រាប់ Vercel។

បន្ទាប់មក Deploy > New deployment > Web app:

- Execute as: Me / User deploying
- Who has access: Anyone

យក Web app URL ដែលបញ្ចប់ដោយ `/exec`។

## 2) Vercel

Upload repository នេះទៅ GitHub ហើយ Import Project ទៅ Vercel។

បន្ថែម Environment Variable:

`APPS_SCRIPT_URL`

Value = Google Apps Script Web App URL របស់អ្នក ឧទាហរណ៍៖

`https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`

**កុំដាក់ token ឬ password របស់ Telegram ក្នុង Vercel frontend។** កូដ Telegram នៅ Google Apps Script backend របស់អ្នកនៅដដែល។

## 3) Local test

អាចបើក `index.html` តាម Vercel preview។ កុំបើកដោយ `file://` ហើយរំពឹងថា `/api/teacher` នឹងដំណើរការ។

## API actions

- `/api/teacher?action=dashboard`
- `/api/teacher?action=classes`
- `/api/teacher?action=student&id=AKKNGS-000001`
- `/api/teacher?action=history&id=AKKNGS-000001`

## អ្វីដែលបានរក្សាទុក

UI, Logo ដែល embed ក្នុង HTML, Khmer title, dashboard, class monitoring, student search និង payment history ត្រូវបានរក្សាទុក។ Backend នៅ Google Sheets + Apps Script មិនត្រូវបានប្តូរទៅ database ថ្មីទេ។
