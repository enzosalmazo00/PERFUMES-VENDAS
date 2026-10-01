(()=>{
  const root=document.querySelector("#inicio .hero-carousel");
  if(!root)return;
  const slides=Array.from(root.querySelectorAll("[data-hero-slide]"));
  const dots=Array.from(root.querySelectorAll("[data-hero-dot]"));
  if(slides.length<2||slides.length!==dots.length)return;

  let current=0;
  let timer=null;
  let touchX=null;

  const show=(index)=>{
    current=(index+slides.length)%slides.length;
    slides.forEach((slide,i)=>{
      const active=i===current;
      slide.classList.toggle("is-active",active);
      slide.setAttribute("aria-hidden",active?"false":"true");
    });
    dots.forEach((dot,i)=>{
      const active=i===current;
      dot.classList.toggle("is-active",active);
      dot.setAttribute("aria-selected",active?"true":"false");
    });
  };

  const stop=()=>{
    if(timer!==null){
      clearInterval(timer);
      timer=null;
    }
  };

  const start=()=>{
    stop();
    if(document.hidden)return;
    timer=setInterval(()=>show(current+1),5000);
  };

  dots.forEach((dot,i)=>{
    dot.addEventListener("click",(e)=>{
      e.preventDefault();
      e.stopPropagation();
      show(i);
      start();
    });
  });

  root.addEventListener("touchstart",(e)=>{
    touchX=e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientX:null;
  },{passive:true});

  root.addEventListener("touchend",(e)=>{
    if(touchX===null)return;
    const end=e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientX:null;
    if(end===null){touchX=null;return;}
    const delta=end-touchX;
    touchX=null;
    if(Math.abs(delta)<40)return;
    show(current+(delta<0?1:-1));
    start();
  },{passive:true});

  document.addEventListener("visibilitychange",()=>document.hidden?stop():start());

  show(0);
  start();
})();
