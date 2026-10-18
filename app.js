/* ĐỖ LONG REVIEW — client application. No API key or secret in this file. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const memoryFallback = new Map();
  const fallbackStorage = {getItem: k => memoryFallback.get(k) || null, setItem: (k,v) => memoryFallback.set(k,String(v)), removeItem: k => memoryFallback.delete(k)};
  function storageFor(name) { try { const value=window[name]; const key='dlr_probe'; value.setItem(key,'1'); value.removeItem(key); return value; } catch { return fallbackStorage; } }
  const localStorage = storageFor('localStorage');
  const sessionStorage = storageFor('sessionStorage');
  const clientId = localStorage.getItem('dlr_client_id') || (() => {
    const value = (window.crypto?.randomUUID?.() || 'dlr-' + Date.now() + Math.random().toString(36)).replace(/[^a-zA-Z0-9_-]/g, '');
    localStorage.setItem('dlr_client_id', value); return value;
  })();
  const state = { active: 'home', image: null, audio: null, video: null, benefitVideo: null, scanImage: null,
    recorder: null, stream: null, chunks: [], clock: null, recordSecs: 0, camera: null, facing: 'user',
    tiktokText: '', benefitsText: '', busy: false, pin: sessionStorage.getItem('dlr_access') || '' };
  const titles = { hook: 'VIẾT HOOK', voice: 'VOICE', tiktok: 'LINK TIKTOK', benefits: 'CÔNG DỤNG SẢN PHẨM', scan: 'QUÉT VĂN BẢN', rewrite: 'VIẾT LẠI' };
  let toastTimeout;

  function toast(message, isError = false) {
    const el = $('toast'); el.textContent = message; el.classList.toggle('error', !!isError);
    el.classList.add('show'); clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), isError ? 4800 : 2600);
  }
  function displayResult(wrapId, outputId, text = '', streaming = false) {
    $(wrapId).hidden = false; $(outputId).textContent = text; $(outputId).classList.toggle('streaming', !!streaming);
  }
  function headers(json = false) {
    return { ...(state.pin ? { 'X-App-Code': state.pin } : {}), ...(json ? {'Content-Type': 'application/json'} : {}) };
  }
  async function jsonRequest(endpoint, options = {}) {
    let response;
    try { response = await fetch(endpoint, { ...options, headers: { ...headers(!!options.json), ...(options.headers || {}) }, body: options.json ? JSON.stringify(options.json) : options.body }); }
    catch { throw new Error('Không kết nối được máy chủ. Hãy mở trang qua địa chỉ web đã triển khai.'); }
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) openPin();
    if (!response.ok) throw new Error(result.detail || 'Có lỗi khi thực hiện yêu cầu.');
    return result;
  }
  async function callStream({ mode, message = '', product = '', source = '', image = null, outputId, wrapId }) {
    if (state.busy) { toast('Đang có tác vụ chạy, vui lòng hoàn tất trước.', true); return; }
    const form = new FormData(); form.append('mode', mode); form.append('message', message);
    form.append('product_name', product); form.append('source_text', source); form.append('client_id', clientId);
    if (image) form.append('image', image);
    setBusy(true); displayResult(wrapId, outputId, '', true);
    let answer = '';
    try {
      const response = await fetch('/api/generate-stream', { method: 'POST', headers: headers(), body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) openPin();
        throw new Error(body.detail || 'Không thể tạo nội dung.');
      }
      if (!response.body) throw new Error('Trình duyệt này không hỗ trợ đọc phản hồi liên tục.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const packets = buffer.split(/\r?\n\r?\n/); buffer = packets.pop() || '';
        for (const packet of packets) {
          const line = packet.split(/\r?\n/).find(row => row.startsWith('data: '));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === 'error') throw new Error(data.message || 'AI trả về lỗi.');
          if (data.type === 'token') { answer += data.text; $(outputId).textContent = answer; }
        }
      }
      if (!answer.trim()) throw new Error('AI chưa trả về nội dung. Hãy thử lại.');
      toast('Đã tạo nội dung và lưu lịch sử.');
      setTimeout(() => $(wrapId).scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
    } catch (e) { if (!answer) { $(outputId).textContent = 'Chưa có kết quả.'; } toast(e.message, true); }
    finally { $(outputId).classList.remove('streaming'); setBusy(false); }
  }
  function setBusy(flag) {
    state.busy = flag;
    document.querySelectorAll('#hookGo,#voiceGo,#tiktokGo,#rewriteGo,#benefitsGo,#scanGo,[data-follow]')
      .forEach(btn => { btn.disabled = flag; btn.classList.toggle('loading', flag); });
  }
  function moveTo(tab) {
    if (!$(tab)) return;
    if (tab !== 'scan') closeCamera();
    if (tab !== 'voice' && state.recorder?.state === 'recording') finishRecording();
    state.active = tab;
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === tab));
    document.querySelectorAll('.bottom-nav button').forEach(el => el.classList.toggle('active', el.dataset.nav === tab));
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (tab === 'scan') openCamera(true);
  }
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => moveTo(el.dataset.nav)));
  $('goHome').addEventListener('click', () => moveTo('home'));
  $('startBtn').addEventListener('click', () => moveTo('hook'));
  document.querySelectorAll('[data-idea]').forEach(el => el.addEventListener('click', () => {
    $('hookPrompt').value = el.dataset.idea; saveDrafts(); toast('Đã thêm ý tưởng vào yêu cầu.');
  }));
  function validateFile(file, allowed, max, label) {
    if (!file) return false;
    if (file.size > max) { toast(`${label} tối đa ${Math.round(max / (1024 * 1024))}MB.`, true); return false; }
    if (allowed && !allowed.some(type => file.type.startsWith(type))) { toast(`Định dạng ${label.toLowerCase()} không phù hợp.`, true); return false; }
    return true;
  }
  $('hookUpload').addEventListener('change', (e) => {
    const file = e.target.files?.[0]; if (!validateFile(file, ['image/'], 8 * 1024 * 1024, 'Ảnh')) return;
    state.image = file; $('hookPreview').src = URL.createObjectURL(file); $('hookPreview').hidden = false;
    $('hookUploadZone').querySelector('.upload-title').textContent = file.name;
  });
  $('hookGo').addEventListener('click', () => {
    const name = $('hookName').value.trim(); const message = $('hookPrompt').value.trim();
    if (!name && !state.image) return toast('Nhập tên hoặc thêm ảnh sản phẩm trước nhé.', true);
    callStream({mode:'hook',message,product:name,image:state.image,outputId:'hookResult',wrapId:'hookResultWrap'});
  });

  function setAudioFile(file) { if (!validateFile(file, ['audio/', 'video/'], 75 * 1024 * 1024, 'Tệp')) return;
    state.audio = file; $('voiceFileLabel').textContent = file.name; toast('Đã chọn file voice.'); }
  $('voiceUpload').addEventListener('change', (e) => setAudioFile(e.target.files?.[0]));
  function timeFmt(sec) { return `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`; }
  function finishRecording() {
    if (state.recorder?.state === 'recording') state.recorder.stop();
    clearInterval(state.clock); state.clock = null;
    $('recordBtn').classList.remove('recording'); document.querySelector('.bars')?.classList.remove('active');
    $('recordLabel').textContent = 'BẢN GHI SẴN SÀNG';
  }
  // media rec event is synchronous with a user tap; Safari typically uses audio/mp4.
  $('recordBtn').addEventListener('click', async () => {
    if (state.recorder?.state === 'recording') return finishRecording();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Trình duyệt không hỗ trợ ghi âm. Hãy tải file âm thanh.', true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const preference = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
      const mimeType = preference.find(m => MediaRecorder.isTypeSupported(m));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      state.recorder = recorder; state.stream = stream; state.chunks = []; state.recordSecs = 0;
      recorder.ondataavailable = e => { if (e.data?.size) state.chunks.push(e.data); };
      recorder.onstop = () => { const mime = recorder.mimeType || 'audio/webm'; const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        state.audio = new File(state.chunks, `voice-${Date.now()}.${ext}`, { type:mime });
        $('voiceFileLabel').textContent = `Bản ghi ${timeFmt(state.recordSecs)} đã sẵn sàng`;
        stream.getTracks().forEach(track => track.stop()); toast('Đã ghi âm xong, bấm Chép Voice ngay.'); };
      recorder.start(500); $('recordBtn').classList.add('recording'); document.querySelector('.bars').classList.add('active');
      $('recordLabel').textContent = 'ĐANG GHI — NHẤN ĐỂ DỪNG'; $('recordTime').textContent = '00:00';
      state.clock = setInterval(() => { state.recordSecs++; $('recordTime').textContent = timeFmt(state.recordSecs); if (state.recordSecs >= 1800) finishRecording(); },1000);
    } catch(e) { toast('Không mở được micro. Hãy kiểm tra quyền micro/HTTPS: ' + (e.message || ''), true); }
  });
  async function transcribeFile(file, kind) {
    const data = new FormData(); data.append('client_id', clientId); data.append('kind', kind); data.append('media', file);
    return jsonRequest('/api/transcribe', { method: 'POST', body: data });
  }
  $('voiceGo').addEventListener('click', async () => {
    if (!state.audio) return toast('Hãy ghi âm hoặc chọn một file voice.', true);
    setBusy(true); displayResult('voiceResultWrap','voiceResult','Đang nhận dạng âm thanh...');
    try { const result = await transcribeFile(state.audio, 'voice');
      $('voiceResult').textContent = $('voiceStyle').checked ? result.text : result.raw;
      toast('Chép voice xong và đã lưu lịch sử.');
    } catch(e) { $('voiceResult').textContent = ''; toast(e.message, true); }
    finally { setBusy(false); }
  });
  function bindMedia(inputId, key, labelId) { $(inputId).addEventListener('change', e => {
    const file = e.target.files?.[0]; if (!validateFile(file, ['audio/','video/'], 75*1024*1024,'Video')) return;
    state[key] = file; $(labelId).textContent = file.name; toast('Đã tải video lên.');
  }); }
  bindMedia('tiktokUpload','video','tiktokFileLabel'); bindMedia('benefitsUpload','benefitVideo','benefitsFileLabel');
  async function transcriptFrom(urlInput, file, kind) {
    if (file) { const result = await transcribeFile(file, kind); return result.text; }
    const link = $(urlInput).value.trim();
    if (!link) throw new Error('Dán link TikTok hoặc tải video lên trước nhé.');
    const result = await jsonRequest('/api/tiktok', {method:'POST',json:{url: link, client_id: clientId,kind}});
    return result.text;
  }
  $('tiktokGo').addEventListener('click', async () => {
    setBusy(true); displayResult('tiktokResultWrap','tiktokResult','Đang lấy lời thoại từ video...');
    try { state.tiktokText = await transcriptFrom('tiktokUrl',state.video,'video');
      $('tiktokResult').textContent = state.tiktokText; toast('Đã chép lời thoại. Có thể viết lại ngay bên dưới.');
    } catch(e) { $('tiktokResult').textContent = ''; toast(e.message,true); }
    finally { setBusy(false); }
  });
  $('rewriteGo').addEventListener('click', () => {
    if (!state.tiktokText) return toast('Chép video trước để có lời thoại nguồn.', true);
    callStream({mode:'rewrite',message:$('rewritePrompt').value,source:state.tiktokText,outputId:'rewriteResult',wrapId:'rewriteResultWrap'});
  });
  $('benefitsGo').addEventListener('click', async () => {
    if (state.busy) return toast('Tác vụ trước chưa xong.',true);
    setBusy(true); displayResult('benefitsResultWrap','benefitsResult','Đang trích lời thoại gốc...');
    try {
      state.benefitsText = await transcriptFrom('benefitsUrl',state.benefitVideo,'benefits');
      $('benefitsResult').textContent = 'Đã có lời thoại nguồn. Đang lọc thông tin có trong video...';
    } catch(e) { $('benefitsResult').textContent = ''; toast(e.message,true); setBusy(false); return; }
    setBusy(false);
    callStream({mode:'benefits',message:$('benefitsPrompt').value || 'Lọc đúng tên và công dụng đã được nói trong video.',source:state.benefitsText,outputId:'benefitsResult',wrapId:'benefitsResultWrap'});
  });
  document.querySelectorAll('[data-follow]').forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.follow; const mapping = {
      hook: ['hookFollow','hookResult','hookResultWrap','hook'],
      voice: ['voiceFollow','voiceResult','voiceResultWrap','voice_style'],
      rewrite: ['rewriteFollow','rewriteResult','rewriteResultWrap','rewrite'],
      benefits: ['benefitsFollow','benefitsResult','benefitsResultWrap','benefits'],
    };
    const [input,output,wrap,mode] = mapping[kind]; const command = $(input).value.trim();
    if (!command) return toast('Hãy nhập yêu cầu chỉnh sửa.',true);
    const previous = $(output).textContent;
    callStream({mode,message:command,source:previous,product:kind==='hook' ? $('hookName').value : '',image:kind==='hook'?state.image:null,outputId:output,wrapId:wrap});
  }));

  function closeCamera(){if(state.camera){state.camera.getTracks().forEach(t=>t.stop());state.camera=null;}$('cameraVideo').hidden=true;$('cameraVideo').srcObject=null;$('cameraPlaceholder').hidden=false;$('snapCamera').disabled=true;}
  async function openCamera(silent=false){
    if(!navigator.mediaDevices?.getUserMedia){if(!silent)toast('Không có quyền truy cập camera. Hãy dùng nút tải ảnh.',true);return;}
    closeCamera();
    try { state.camera = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing},width:{ideal:1280},height:{ideal:720}},audio:false});
      $('cameraVideo').srcObject=state.camera;$('cameraVideo').hidden=false;$('cameraPlaceholder').hidden=true;$('snapCamera').disabled=false;
      await $('cameraVideo').play().catch(()=>{});
    }catch(e){if(!silent)toast('Không bật được camera. Kiểm tra HTTPS và quyền camera: '+e.message,true);}
  }
  $('openCamera').addEventListener('click',()=>openCamera());
  $('flipCamera').addEventListener('click',()=>{state.facing=state.facing==='user'?'environment':'user';openCamera();});
  function previewScanFile(file){state.scanImage=file;const preview=$('scanPreview');preview.src=URL.createObjectURL(file);preview.hidden=false;$('scanFileLabel').textContent=file.name;}
  $('snapCamera').addEventListener('click',()=>{
    const video=$('cameraVideo');if(!state.camera||!video.videoWidth)return toast('Camera chưa sẵn sàng.',true);
    const canvas=document.createElement('canvas');const scale=Math.min(1,1800/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{if(!blob)return toast('Không thể chụp ảnh.',true);previewScanFile(new File([blob],`scan-${Date.now()}.jpg`,{type:'image/jpeg'}));toast('Đã chụp ảnh, bấm Nhận diện văn bản.');},'image/jpeg',.88);
  });
  $('scanUpload').addEventListener('change',e=>{const file=e.target.files?.[0];if(!validateFile(file,['image/'],8*1024*1024,'Ảnh'))return;previewScanFile(file);});
  $('scanGo').addEventListener('click',async()=>{
    if(!state.scanImage)return toast('Chụp ảnh hoặc chọn ảnh có chữ trước nhé.',true);
    setBusy(true);displayResult('scanResultWrap','scanResult','Đang nhận diện chữ...');
    try{const data=new FormData();data.append('client_id',clientId);data.append('image',state.scanImage);
      const response=await jsonRequest('/api/ocr',{method:'POST',body:data});$('scanResult').textContent=response.text;toast('Đã quét chữ, có thể sao chép.');
    }catch(e){$('scanResult').textContent='';toast(e.message,true);}finally{setBusy(false);}
  });
  document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{
    const content=$(btn.dataset.copy).textContent;if(!content)return toast('Chưa có nội dung để sao chép.',true);
    try { await navigator.clipboard.writeText(content); } catch { const tmp=document.createElement('textarea');tmp.value=content;tmp.style.position='fixed';tmp.style.opacity='0';document.body.appendChild(tmp);tmp.select();document.execCommand('copy');tmp.remove(); }
    toast('Đã sao chép vào bộ nhớ tạm.');
  }));
  function openPin(){$('pinModal').hidden=false;setTimeout(()=>$('pinInput').focus(),180);}
  $('pinForm').addEventListener('submit',async(e)=>{
    e.preventDefault();const pin=$('pinInput').value.trim();if(!pin)return;
    state.pin=pin;sessionStorage.setItem('dlr_access',pin);$('pinModal').hidden=true;
    try{await jsonRequest('/api/history?client_id='+encodeURIComponent(clientId));toast('Mã truy cập đã được chấp nhận.');}
    catch(e){state.pin='';sessionStorage.removeItem('dlr_access');openPin();toast('Mã truy cập chưa đúng.',true);}
  });
  $('historyBtn').addEventListener('click',async()=>{
    $('historyModal').hidden=false;$('historyList').textContent='Đang tải lịch sử...';
    try { const data=await jsonRequest('/api/history?client_id='+encodeURIComponent(clientId));const list=$('historyList');list.textContent='';
      if(!data.items.length){list.textContent='Chưa có nội dung. Hãy tạo hook hoặc chép một video để lưu vào đây.';return;}
      for(const item of data.items){
        const button=document.createElement('button');button.type='button';button.className='history-item';
        const meta=document.createElement('div');meta.className='history-item-top';
        const category=document.createElement('span');category.textContent=titles[item.tool]||item.tool.toUpperCase();
        const date=document.createElement('small');date.textContent=new Date(item.created_at).toLocaleString('vi-VN');meta.append(category,date);
        const p=document.createElement('p');p.textContent=(item.output||'').slice(0,135)+'...';button.append(meta,p);
        button.addEventListener('click',()=>{
          const page = item.tool==='rewrite'?'tiktok':item.tool==='voice_style'||item.tool==='transcribe_voice'?'voice':item.tool.startsWith('tiktok_')||item.tool==='transcribe_video'?'tiktok':item.tool==='transcribe_benefits'?'benefits':item.tool;
          if($(page))moveTo(page); else if(item.tool==='ocr')moveTo('scan');
          const lookups={hook:['hookResultWrap','hookResult'],voice:['voiceResultWrap','voiceResult'],tiktok:['tiktokResultWrap','tiktokResult'],rewrite:['rewriteResultWrap','rewriteResult'],benefits:['benefitsResultWrap','benefitsResult'],scan:['scanResultWrap','scanResult'],ocr:['scanResultWrap','scanResult']};
          const pair=lookups[item.tool]||lookups[page]||lookups.scan;
          displayResult(pair[0],pair[1],item.output);
          if(item.tool==='rewrite')state.tiktokText=item.source_text||'';
          if(item.tool==='tiktok_video'||item.tool==='transcribe_video')state.tiktokText=item.output;
          if(item.tool==='transcribe_benefits')state.benefitsText=item.output;
          $('historyModal').hidden=true;
        });list.appendChild(button);
      }
    }catch(e){$('historyList').textContent=e.message;toast(e.message,true);}
  });
  $('closeHistory').addEventListener('click',()=>{$('historyModal').hidden=true;});
  $('historyModal').addEventListener('click',e=>{if(e.target===$('historyModal'))$('historyModal').hidden=true;});
  // Local draft persistence complements (but does not replace) server conversation history.
  const draftFields=['hookName','hookPrompt','tiktokUrl','rewritePrompt','benefitsUrl','benefitsPrompt'];
  function saveDrafts(){for(const id of draftFields)localStorage.setItem('dlr_draft_'+id,$(id).value);}
  draftFields.forEach(id=>{$(id).value=localStorage.getItem('dlr_draft_'+id)||'';$(id).addEventListener('input',saveDrafts);});
  (async function start(){
    try{const status=await jsonRequest('/api/health');const badge=$('statusBadge');badge.classList.add(status.aiConfigured?'ready':'warn');
      badge.querySelector('span').textContent=status.aiConfigured?'AI SẴN SÀNG':'CHƯA KẾT NỐI AI';
      if(status.pinRequired&&!state.pin)openPin();
    }catch{$('statusBadge').querySelector('span').textContent='CHƯA CÓ SERVER';$('statusBadge').classList.add('warn');}
  })();
})();
