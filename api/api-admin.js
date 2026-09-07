// Vercel Serverless Function: Admin Portal -> Google Apps Script
const ALLOWED = new Set([
  'login','me','admin_dashboard','admin_students','admin_student',
  'admin_save_student','admin_archive_student','admin_payments',
  'admin_save_payment','admin_delete_payment','admin_teachers',
  'admin_users','admin_save_user','admin_toggle_user','admin_export_csv',
  'admin_daily_report','admin_monthly_report'
]);
module.exports = async function handler(req,res){
  try{
    const method=String(req.method||'GET').toUpperCase();
    const params=method==='POST'?(req.body&&typeof req.body==='object'?req.body:{}):(req.query||{});
    const action=String(params.action||'').trim().toLowerCase();
    if(!ALLOWED.has(action)) return res.status(400).json({success:false,message:'Invalid admin API action.'});
    const url=process.env.APPS_SCRIPT_URL;
    if(!url) return res.status(500).json({success:false,message:'APPS_SCRIPT_URL is not configured.'});
    const body={action};
    if(action==='login'){
      body.username=String(params.username||'').trim();
      body.password=String(params.password||'');
      if(!body.username||!body.password)return res.status(400).json({success:false,message:'Username និង Password ត្រូវបានទាមទារ។'});
    }else{
      body.token=String(params.token||'').trim();
      if(!body.token)return res.status(401).json({success:false,message:'Session token មិនមាន។'});
      for(const k of ['id','rowNumber','username','active']) if(params[k]!==undefined) body[k]=params[k];
      for(const k of ['filters','student','payment','user']) if(params[k]!==undefined) body[k]=params[k];
    }
    const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),redirect:'follow',cache:'no-store'});
    const text=await upstream.text();let data;
    try{data=JSON.parse(text)}catch(e){return res.status(502).json({success:false,message:'Google Apps Script did not return valid JSON.',upstreamStatus:upstream.status})}
    res.setHeader('Cache-Control','no-store,max-age=0,must-revalidate');
    return res.status(upstream.ok?200:(upstream.status||502)).json(data);
  }catch(error){console.error('Admin API error:',error);return res.status(500).json({success:false,message:'Admin API request failed.'})}
};
