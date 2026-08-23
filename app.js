const routeURL="data/route3d.json";
const summaryURL="data/summary.json";
let map, routeVisible=true, buildingsVisible=true, initial;

async function boot(){
  const [route,summary]=await Promise.all([
    fetch(routeURL).then(r=>r.json()),
    fetch(summaryURL).then(r=>r.json())
  ]);
  const coords=route.features[0].geometry.coordinates;
  const center=coords.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]).map(v=>v/coords.length);
  initial={center,zoom:15.3,pitch:62,bearing:24};

  document.getElementById("duration").textContent=`${summary.duration_min} 分`;
  document.getElementById("distance").textContent=`${(summary.distance_m/1000).toFixed(2)} km`;
  document.getElementById("elev").textContent=`${summary.height_min_m}〜${summary.height_max_m} m`;
  document.getElementById("speed").textContent=`${(summary.speed_mean_mps*3.6).toFixed(1)} km/h`;

  map=new maplibregl.Map({
    container:"map",
    style:"https://tiles.openfreemap.org/styles/liberty",
    center:initial.center,
    zoom:initial.zoom,
    pitch:initial.pitch,
    bearing:initial.bearing,
    antialias:true
  });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");
  map.on("load",()=>{
    addLayers(route);
    document.getElementById("loading").classList.add("hidden");
  });
  map.on("error",e=>console.warn(e));

  document.getElementById("reset").onclick=()=>map.jumpTo(initial);
  document.getElementById("toggleRoute").onclick=()=>{
    routeVisible=!routeVisible;
    const v=routeVisible?"visible":"none";
    ["sensor-route","sensor-route-glow","sensor-points","elevation-blocks"].forEach(id=>map.setLayoutProperty(id,"visibility",v));
    document.getElementById("toggleRoute").textContent=routeVisible?"ルート":"ルートOFF";
  };
  document.getElementById("toggleBuildings").onclick=()=>{
    buildingsVisible=!buildingsVisible;
    toggleBuildingLayers();
    document.getElementById("toggleBuildings").textContent=buildingsVisible?"建物3D":"建物3D OFF";
  };
}

function addLayers(route){
  map.addSource("sensor-route-data",{type:"geojson",data:route});

  map.addLayer({
    id:"sensor-route-glow",type:"line",source:"sensor-route-data",
    layout:{visibility:"visible","line-cap":"round","line-join":"round"},
    paint:{"line-color":"#7dd3fc","line-width":11,"line-opacity":.18,"line-blur":3}
  });
  map.addLayer({
    id:"sensor-route",type:"line",source:"sensor-route-data",
    layout:{visibility:"visible","line-cap":"round","line-join":"round"},
    paint:{"line-color":"#ffffff","line-width":4.5,"line-opacity":.98}
  });

  map.addLayer({
    id:"sensor-points",type:"circle",source:"sensor-route-data",
    layout:{visibility:"visible"},
    paint:{
      "circle-radius":6,
      "circle-color":["interpolate",["linear"],["get","h"],-20,"#60a5fa",0,"#e2e8f0",20,"#f59e0b"],
      "circle-stroke-color":"#0b1725",
      "circle-stroke-width":2
    }
  });

  // Small extruded blocks visualize relative recorded elevation along the route.
  const blocks={type:"FeatureCollection",features:[]};
  route.features[0].geometry.coordinates.forEach(p=>{
    const size=.00007;
    const h=Math.max(3,Math.min(35,(p[2]||0)+18));
    const lng=p[0],lat=p[1];
    blocks.features.push({
      type:"Feature",
      properties:{height:h},
      geometry:{type:"Polygon",coordinates:[[[lng-size,lat-size],[lng+size,lat-size],[lng+size,lat+size],[lng-size,lat+size],[lng-size,lat-size]]]}
    });
  });
  map.addSource("elevation-blocks",{type:"geojson",data:blocks});
  map.addLayer({
    id:"elevation-blocks",type:"fill-extrusion",source:"elevation-blocks",
    paint:{"fill-extrusion-color":"#38bdf8","fill-extrusion-height":["get","height"],"fill-extrusion-base":0,"fill-extrusion-opacity":.55}
  });
}

function toggleBuildingLayers(){
  for(const l of map.getStyle().layers||[]){
    if(l.type==="fill-extrusion" && l.id!=="elevation-blocks"){
      try{map.setLayoutProperty(l.id,"visibility",buildingsVisible?"visible":"none");}catch{}
    }
  }
}

boot().catch(err=>{
  console.error(err);
  document.getElementById("loading").textContent="3D地図の読み込みに失敗しました。少し待ってから再読み込みしてください。";
});