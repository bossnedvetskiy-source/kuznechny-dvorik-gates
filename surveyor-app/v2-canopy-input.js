export const CANOPY_DEFAULTS=Object.freeze({widthMm:3400,lengthMm:8400,visibleHeightMm:2100,riseMm:567,trussHeightMm:250,overhangMm:150,endFlatMm:300,cellStepMm:400,coverage:'Поликарбонат',trussType:'Треугольная',materialMode:'30×30×2',lagMode:'Стандарт',installType:'Бетонирование',postsNeeded:true,existingPosts:0,beamsExisting:false,paint:true});
const int=(v,min,max)=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
export function normalizeCanopyInput(input={}){
 const s={...CANOPY_DEFAULTS};
 for(const key of Object.keys(s))if(Object.hasOwn(input,key))s[key]=input[key];
 const invalid=reason=>{throw Error(reason)};
 // Legacy geometry treats zero overhang/end flat as default, not zero. Reject instead of silently substituting.
 for(const [key,min,max] of [['widthMm',1500,6000],['lengthMm',1000,12000],['visibleHeightMm',1000,5000],['riseMm',100,2000],['trussHeightMm',120,600],['overhangMm',1,600],['endFlatMm',1,800],['cellStepMm',250,700],['existingPosts',0,100]])if(!int(s[key],min,max))return invalid('Проверьте '+key+': допустимо '+min+'–'+max+' мм / шт.');
 if(!['Поликарбонат','Профнастил','Без покрытия'].includes(s.coverage)||!['Треугольная','Вертикальная','Усиленная'].includes(s.trussType)||!['Авто','30×30×2','40×20×2'].includes(s.materialMode)||!['Стандарт','Эконом'].includes(s.lagMode)||!['Бетонирование','Закладные'].includes(s.installType)||['postsNeeded','beamsExisting','paint'].some(k=>typeof s[k]!=='boolean'))return invalid('Проверьте комплектацию.');
 const raw={widthPostsM:Number(s.widthMm)/1000,lengthM:Number(s.lengthMm)/1000,visibleHeightM:Number(s.visibleHeightMm)/1000,riseMm:Number(s.riseMm),heightMm:Number(s.trussHeightMm),overhangMm:Number(s.overhangMm),endFlatMm:Number(s.endFlatMm),cellStepMm:Number(s.cellStepMm),coverage:s.coverage,trussType:s.trussType,materialMode:s.materialMode,lagMode:s.lagMode,installType:s.installType,postsNeeded:s.postsNeeded,existingPosts:s.postsNeeded?Number(s.existingPosts):0,beamsExisting:s.beamsExisting,paint:s.paint,delivery:0};
 return {configuration:s,raw};
}
