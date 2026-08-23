const routeURL="data/route3d.json";
const summaryURL="data/summary.json";
let map, initial, routeBounds, userMarker, accuracyCircle, watchId=null, followUser=false;

async function boot(){
  const [route,summary]=await Promise.all([
    fetch(routeURL).then(r=>r.json()),
    fetch(summaryURL).then(r=>r.json())
  ]);
  const coords=route.features[0].geometry.coordinates;
  routeBounds=coords.reduce((b,p)=>b.extend([p[0],p[1]]),new maplibregl.LngLatBounds([coords[0][0],coords[0][1]],[coords[0][0],coords[0][1]]));
  initial={center:routeBounds.getCenter(),zoom:15.8,pitch:45,bearing:0};

  duration.textContent=`${summary.duration_min} 分`;
  distance.textContent=`${(summary.distance_m/1000).toFixed(2)} km`;
  elev.textContent=`${summary.height_min_m}〜${summary.height_max_m} m`;
  speed.textContent=`${(summary.speed_mean_mps*3.6).toFixed(1)} km/h`;

  map=new maplibregl.Map({container:"map",style:"https://tiles.openfreemap.org/styles/liberty",...initial,antialias:true});
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");
  map.on("load",()=>{
    map.addSource("sensor-route-data",{type:"geojson",data:route});
    map.addLayer({id:"route-outline",type:"line",source:"sensor-route-data",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#ffffff","line-width":8,"line-opacity":.95}});
    map.addLayer({id:"sensor-route",type:"line",source:"sensor-route-data",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#2563eb","line-width":5,"line-opacity":.98}});
    map.addSource("route-start",{type:"geojson",data:{type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Point",coordinates:coords[0]}}]}});
    map.addSource("route-end",{type:"geojson",data:{type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Point",coordinates:coords[coords.length-1]}}]}});
    map.addLayer({id:"route-start",type:"circle",source:"route-start",paint:{"circle-radius":8,"circle-color":"#22c55e","circle-stroke-color":"#fff","circle-stroke-width":3}});
    map.addLayer({id:"route-end",type:"circle",source:"route-end",paint:{"circle-radius":8,"circle-color":"#ef4444","circle-stroke-color":"#fff","circle-stroke-width":3}});
    document.getElementById("loading").classList.add("hidden");
    fitRoute();
  });

  fitRouteBtn();
  document.getElementById("locate").onclick=startLocation;
  document.getElementById("follow").onclick=()=>{followUser=!followUser; document.getElementById("follow").textContent=followUser?"追従中":"現在地を追従";};
}
function fitRouteBtn(){document.getElementById("fitRoute").onclick=fitRoute;}
function fitRoute(){if(routeBounds)map.fitBounds(routeBounds,{padding:{top:100,bottom:100,left:80,right:80},duration:800,maxZoom:17});}
function startLocation(){
  const status=document.getElementById("locationStatus");
  if(!navigator.geolocation){status.textContent="このブラウザは位置情報に対応していません";return;}
  status.textContent="現在地を取得中…";
  if(watchId!==null) navigator.geolocation.clearWatch(watchId);
  watchId=navigator.geolocation.watchPosition(updatePosition,err=>{
    status.textContent=err.code===1?"位置情報の許可が必要です":"現在地を取得できません";
  },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
}
function updatePosition(pos){
  const {longitude,latitude,accuracy}=pos.coords;
  const lngLat=[longitude,latitude];
  const status=document.getElementById("locationStatus");
  status.textContent=`現在地: 精度 約${Math.round(accuracy)}m`;
  document.getElementById("follow").disabled=false;
  if(!userMarker){
    const el=document.createElement("div"); el.className="user-dot";
    userMarker=new maplibregl.Marker({element:el}).setLngLat(lngLat).addTo(map);
    map.addSource("user-accuracy",{type:"geojson",data:accuracyFeature(lngLat,accuracy)});
    map.addLayer({id:"user-accuracy",type:"fill",source:"user-accuracy",paint:{"fill-color":"#2563eb","fill-opacity":.12}});
    map.flyTo({center:lngLat,zoom:17,duration:900});
  }else{
    userMarker.setLngLat(lngLat);
    map.getSource("user-accuracy").setData(accuracyFeature(lngLat,accuracy));
    if(followUser)map.easeTo({center:lngLat,duration:600});
  }
}
function accuracyFeature(center,radius){
  const pts=[],steps=48; const lat=center[1];
  for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2;const dx=Math.cos(a)*radius,dy=Math.sin(a)*radius;pts.push([center[0]+dx/(111320*Math.cos(lat*Math.PI/180)),center[1]+dy/110540]);}
  return {type:"Feature",geometry:{type:"Polygon",coordinates:[pts]}};
}
boot().catch(err=>{console.error(err);loading.textContent="地図の読み込みに失敗しました。再読み込みしてください。";});