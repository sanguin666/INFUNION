import { MAP_STYLE_URL, PLACE_KINDS, pinSvg } from '../theme/placeKinds';
import type { PoiType } from '../api/types';

// Pinned, and loaded by the page itself: the phone fetches it from the CDN
// the first time the map opens.
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl';

export type MapPin = { id: string; type: PoiType; latitude: number; longitude: number; name: string };

/** What the app tells the map page. */
export type ToMap =
  | { type: 'places'; pins: MapPin[]; origin: { latitude: number; longitude: number } | null }
  | { type: 'select'; id: string | null };

/** What the map page tells the app. */
export type FromMap = { type: 'ready' } | { type: 'select'; id: string } | { type: 'error' };

/**
 * The map of communities as one self-contained page, so the phone (in a
 * WebView) and the web build (in an iframe) draw exactly the same map:
 * MapLibre with OpenFreeMap's OpenStreetMap tiles, warmed toward ANSAE's
 * beige, one pin per place in its kind's colour and symbol.
 */
export function placesMapHtml(): string {
  const pins = Object.fromEntries(PLACE_KINDS.map((kind) => [kind, pinSvg(kind, 36)]));
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}.css">
<style>
html,body,#map{margin:0;height:100%;width:100%;background:#F4EEE4}
.pin{z-index:1;cursor:pointer;transform-origin:50% 100%;transition:transform .15s}
.pin.selected{transform:scale(1.35);z-index:3}
.pin svg{display:block}
.me{z-index:0;width:18px;height:18px;border-radius:50%;background:#2F6FDE;border:3px solid #fff;box-shadow:0 0 0 10px rgba(47,111,222,.18)}
.maplibregl-ctrl-attrib{font:11px sans-serif}
</style></head><body><div id="map"></div>
<script src="${MAPLIBRE}.js"></script>
<script>
var PINS=${JSON.stringify(pins)};
function send(message){
  var text=JSON.stringify(message);
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(text)}
  else if(window.parent!==window){window.parent.postMessage({source:'ansae-map',data:text},'*')}
}
if(!window.maplibregl){send({type:'error'})}else{
var map=new maplibregl.Map({container:'map',style:'${MAP_STYLE_URL}',center:[-0.5,40],zoom:5,attributionControl:{compact:true}});
var markers={},me=null,fitted=false,selected=null,pending=[];
map.on('load',function(){
  (map.getStyle().layers||[]).forEach(function(l){try{
    if(l.type==='background')map.setPaintProperty(l.id,'background-color','#F4EEE4');
    if(l.type==='fill'&&/water/.test(l.id))map.setPaintProperty(l.id,'fill-color','#CFE0EA');
    if(l.type==='fill'&&/park|wood|grass/.test(l.id))map.setPaintProperty(l.id,'fill-color','#DDE8D2');
  }catch(e){}});
});
function select(id){
  if(selected&&markers[selected])markers[selected].getElement().classList.remove('selected');
  selected=id;
  var m=id&&markers[id];
  if(m){m.getElement().classList.add('selected');map.easeTo({center:m.getLngLat(),offset:[0,-Math.round(window.innerHeight*0.28)],duration:400});}
}
function setPlaces(msg){
  Object.keys(markers).forEach(function(id){markers[id].remove()});markers={};
  msg.pins.forEach(function(p){
    var el=document.createElement('div');el.className='pin';el.innerHTML=PINS[p.type]||PINS.church;
    el.setAttribute('role','button');el.setAttribute('aria-label',p.name);
    el.addEventListener('click',function(e){e.stopPropagation();select(p.id);send({type:'select',id:p.id})});
    markers[p.id]=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([p.longitude,p.latitude]).addTo(map);
  });
  if(me){me.remove();me=null}
  if(msg.origin){var d=document.createElement('div');d.className='me';me=new maplibregl.Marker({element:d}).setLngLat([msg.origin.longitude,msg.origin.latitude]).addTo(map)}
  if(selected)select(selected);
  if(!fitted){
    fitted=true;
    // Around the person: them and the nearest few. Otherwise everything.
    var points=(msg.origin?msg.pins.slice(0,6):msg.pins).map(function(p){return[p.longitude,p.latitude]});
    if(msg.origin)points.push([msg.origin.longitude,msg.origin.latitude]);
    if(points.length===1){map.jumpTo({center:points[0],zoom:14})}
    else if(points.length>1){var b=new maplibregl.LngLatBounds(points[0],points[0]);points.forEach(function(p){b.extend(p)});map.fitBounds(b,{padding:{top:60,bottom:60,left:40,right:40},maxZoom:15,duration:0})}
  }
}
window.receive=function(msg){if(typeof msg==='string')msg=JSON.parse(msg);if(msg.type==='places')setPlaces(msg);if(msg.type==='select')select(msg.id)};
window.addEventListener('message',function(e){if(e.data&&e.data.source==='ansae-app')window.receive(e.data.data)});
map.on('click',function(){select(null);send({type:'select',id:''})});
send({type:'ready'});
}
</script></body></html>`;
}
