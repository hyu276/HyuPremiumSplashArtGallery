const reloadScrollGuard=`
(()=>{
  try{
    const navigation=performance.getEntriesByType?.('navigation')?.[0];
    const isReload=navigation?navigation.type==='reload':performance.navigation?.type===1;
    if(!isReload)return;

    const previousRestoration=history.scrollRestoration;
    history.scrollRestoration='manual';

    const resetScroll=()=>window.scrollTo({top:0,left:0,behavior:'auto'});
    resetScroll();
    requestAnimationFrame(()=>{
      resetScroll();
      requestAnimationFrame(resetScroll);
    });

    const finish=()=>{
      resetScroll();
      setTimeout(()=>{history.scrollRestoration=previousRestoration},0);
    };

    if(document.readyState==='complete')finish();
    else addEventListener('load',finish,{once:true});
  }catch{}
})();
`;

export default function CharacterLayout({children}:{children:React.ReactNode}){
  return <><script dangerouslySetInnerHTML={{__html:reloadScrollGuard}}/>{children}</>;
}
