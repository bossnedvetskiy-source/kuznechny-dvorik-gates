fixedDeliveryForCity = function fixedDeliveryForCityRuntime(city, site, deliverySettings = DEFAULT_DELIVERY_PRICES) {
  const destinations=Array.isArray(deliverySettings?.destinations)?deliverySettings.destinations:[];
  const known=destinations.find(item=>normalizeDeliveryServer(item.name)===normalizeDeliveryServer(city));
  if(!known)return null;
  return {kind:'fixed',city:String(known.name||city),price:Math.max(0,Math.round(Number(known.price)||0)),distanceKm:null,serviceAreaKm:Math.max(0,Number(site?.serviceAreaKm)||150),outOfArea:false,resolved:true};
};

authoritativeDeliveryForLead = async function authoritativeDeliveryForLeadRuntime(city, env, site) {
  const deliverySettings=await loadDeliverySettings(env);
  const fixed=fixedDeliveryForCity(city,site,deliverySettings);
  if(fixed)return fixed;
  try{
    const routed=await calculateUnknownDelivery(city,env);
    if(routed?.outOfArea)return {kind:'out-of-area',city:routed.shortName||city,price:null,distanceKm:Number(routed.distanceKm)||null,serviceAreaKm:Number(routed.serviceAreaKm)||Number(site?.serviceAreaKm)||150,outOfArea:true,resolved:false};
    return {kind:'calculated',city:routed.shortName||city,price:Math.max(0,Math.round(Number(routed.price)||0)),distanceKm:Number(routed.distanceKm)||null,serviceAreaKm:Number(routed.serviceAreaKm)||Number(site?.serviceAreaKm)||150,outOfArea:false,resolved:true};
  }catch(error){
    return {kind:'error',city,price:null,distanceKm:null,serviceAreaKm:Number(site?.serviceAreaKm)||150,outOfArea:false,resolved:false,error:String(error?.message||'Не удалось рассчитать доставку')};
  }
};
