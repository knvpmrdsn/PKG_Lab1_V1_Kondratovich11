window.addEventListener('DOMContentLoaded',()=>{
  const view=new AppView.AppView();
  window.app=new AppController(view);
  runColorTests(false);
});
