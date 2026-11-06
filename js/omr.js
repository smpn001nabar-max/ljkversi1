(function () {
  'use strict';
  const TARGET_W = 794, TARGET_H = 1123;

  function fileToImage(file) {
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file); const img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Gambar tidak dapat dibaca.'));};
      img.src=url;
    });
  }
  function canvasFromImage(img,maxWidth) {
    const scale=Math.min(1,(maxWidth||1800)/img.naturalWidth);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(img.naturalWidth*scale); canvas.height=Math.round(img.naturalHeight*scale);
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,canvas.width,canvas.height);
    return canvas;
  }
  function decodeQr(canvas) {
    if (!window.jsQR) return null;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const image=ctx.getImageData(0,0,canvas.width,canvas.height);
    return window.jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});
  }
  function orderCorners(points) {
    const sum=points.map(p=>p.x+p.y), diff=points.map(p=>p.x-p.y);
    return [points[sum.indexOf(Math.min(...sum))],points[diff.indexOf(Math.max(...diff))],points[sum.indexOf(Math.max(...sum))],points[diff.indexOf(Math.min(...diff))]];
  }
  function detectAndWarp(sourceCanvas) {
    const cv=window.cv;
    const src=cv.imread(sourceCanvas);
    const gray=new cv.Mat(),blur=new cv.Mat(),thresh=new cv.Mat(),hierarchy=new cv.Mat(),contours=new cv.MatVector();
    let warpedCanvas=null, quality='BAIK', detected=false;
    try {
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
      cv.threshold(blur,thresh,0,255,cv.THRESH_BINARY_INV+cv.THRESH_OTSU);
      cv.findContours(thresh,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
      let best=null,bestArea=0;
      for(let i=0;i<contours.size();i++){
        const contour=contours.get(i); const area=cv.contourArea(contour);
        if(area<sourceCanvas.width*sourceCanvas.height*.22||area<=bestArea){contour.delete();continue;}
        const peri=cv.arcLength(contour,true); const approx=new cv.Mat();
        cv.approxPolyDP(contour,approx,.02*peri,true);
        if(approx.rows===4){if(best)best.delete();best=approx;bestArea=area;}
        else approx.delete();
        contour.delete();
      }
      if(best){
        const points=[];
        for(let i=0;i<4;i++)points.push({x:best.intAt(i,0),y:best.intAt(i,1)});
        const ordered=orderCorners(points);
        const srcPts=cv.matFromArray(4,1,cv.CV_32FC2,[ordered[0].x,ordered[0].y,ordered[1].x,ordered[1].y,ordered[2].x,ordered[2].y,ordered[3].x,ordered[3].y]);
        const dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,TARGET_W-1,0,TARGET_W-1,TARGET_H-1,0,TARGET_H-1]);
        const matrix=cv.getPerspectiveTransform(srcPts,dstPts);
        const output=new cv.Mat();
        cv.warpPerspective(src,output,matrix,new cv.Size(TARGET_W,TARGET_H),cv.INTER_CUBIC,cv.BORDER_CONSTANT,new cv.Scalar(255,255,255,255));
        warpedCanvas=document.createElement('canvas');warpedCanvas.width=TARGET_W;warpedCanvas.height=TARGET_H;cv.imshow(warpedCanvas,output);
        srcPts.delete();dstPts.delete();matrix.delete();output.delete();best.delete();detected=true;
      }
      if(!detected){
        warpedCanvas=document.createElement('canvas');warpedCanvas.width=TARGET_W;warpedCanvas.height=TARGET_H;
        const ctx=warpedCanvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,TARGET_W,TARGET_H);ctx.drawImage(sourceCanvas,0,0,TARGET_W,TARGET_H);
        quality='PERIKSA_POSISI';
      }
    } finally { src.delete();gray.delete();blur.delete();thresh.delete();hierarchy.delete();contours.delete(); }
    return {canvas:warpedCanvas,detected:detected,quality:quality};
  }
  function bubbleDarkness(imageData,cx,cy) {
    const data=imageData.data,w=imageData.width,h=imageData.height;
    let dark=0,total=0;
    for(let y=-6;y<=6;y++)for(let x=-6;x<=6;x++){
      const r=Math.sqrt(x*x+y*y);
      if(r<4.1||r>6.2)continue;
      const px=Math.round(cx+x),py=Math.round(cy+y);
      if(px<0||py<0||px>=w||py>=h)continue;
      const i=(py*w+px)*4;
      const lum=.299*data[i]+.587*data[i+1]+.114*data[i+2];
      if(lum<145)dark++; total++;
    }
    return total?dark/total:0;
  }
  function parseQr(raw) {
    const parts=String(raw||'').split('|');
    if(parts.length>=3&&parts[0]==='SLJS')return {tokenQr:parts[1],page:Number(parts[2])||1};
    if(parts.length>=2&&parts[0]==='SLJS')return {tokenQr:parts[1],page:1};
    return null;
  }
  async function processFile(file,exam) {
    await Promise.all([window.Deps.load('jsqr'),window.Deps.load('opencv')]);
    const img=await fileToImage(file);
    const original=canvasFromImage(img,1800);
    let qr=decodeQr(original);
    const corrected=detectAndWarp(original);
    if(!qr)qr=decodeQr(corrected.canvas);
    const identity=qr?parseQr(qr.data):null;
    if(!identity)throw new Error('QR lembar jawaban tidak terbaca. Pastikan kode QR utuh dan tidak tertutup.');
    const pageCount=Math.ceil(Number(exam.jumlahSoal)/window.AnswerSheet.PAGE_SIZE);
    if(identity.page<1||identity.page>pageCount)throw new Error('Nomor halaman pada QR tidak sesuai ujian.');
    const imageData=corrected.canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,TARGET_W,TARGET_H);
    const map=window.AnswerSheet.getBubbleCoordinates(Number(exam.jumlahSoal),identity.page);
    const optionLetters=['A','B','C','D','E'].slice(0,Number(exam.jumlahPilihan));
    const answers=map.map(q=>{
      if(!corrected.detected)return {nomor:q.nomor,jawaban:'',confidence:0,status:'TIDAK_TERBACA'};
      const scores=q.options.slice(0,optionLetters.length).map(o=>bubbleDarkness(imageData,o.x,o.y));
      const sorted=scores.map((score,i)=>({score:score,option:optionLetters[i]})).sort((a,b)=>b.score-a.score);
      const top=sorted[0]||{score:0,option:''},second=sorted[1]||{score:0,option:''};
      let status='AMBIGU',answer='';
      if(top.score>=.32&&second.score>=.32){status='GANDA';}
      else if(top.score<.18){status='KOSONG';}
      else if(top.score>=.32&&top.score-second.score>=.12){status='OK';answer=top.option;}
      else status='AMBIGU';
      return {nomor:q.nomor,jawaban:answer,confidence:Math.round(top.score*1000)/1000,status:status};
    });
    const saveCanvas=original;
    const saveData=saveCanvas.toDataURL('image/jpeg',.68);
    return {
      tokenQr:identity.tokenQr,page:identity.page,answers:answers,
      imageBase64:saveData,mimeType:'image/jpeg',fileName:file.name||'hasil-scan.jpg',
      preview:corrected.canvas.toDataURL('image/jpeg',.72),quality:corrected.quality,
      filled:answers.filter(a=>a.status==='OK').length,ambiguous:answers.filter(a=>a.status==='AMBIGU'||a.status==='GANDA').length,
      pageCount:pageCount
    };
  }
  window.OMR = { processFile:processFile };
})();
