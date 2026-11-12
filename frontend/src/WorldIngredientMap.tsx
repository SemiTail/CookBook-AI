/// <reference types="vite/client" />
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { geoArea, geoCentroid, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-50m.json";

import ukraineBoundary from "./data/ukraine-boundary.json";

import "./world-ingredient-map.css";

export type CountryOption = { code: string; name: string; flag: string; count: number };

type Props = {
  countries: CountryOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
};
type CountryMetadata = { cca2: string; ccn3?: string; latlng: number[] };
type View = { scale: number; x: number; y: number };
const WIDTH = 1000;
const HEIGHT = 520;
const metadata: CountryMetadata[] = [{"cca2":"AW","ccn3":"533","latlng":[12.5,-69.96666666]},{"cca2":"AF","ccn3":"004","latlng":[33,65]},{"cca2":"AO","ccn3":"024","latlng":[-12.5,18.5]},{"cca2":"AI","ccn3":"660","latlng":[18.25,-63.16666666]},{"cca2":"AX","ccn3":"248","latlng":[60.116667,19.9]},{"cca2":"AL","ccn3":"008","latlng":[41,20]},{"cca2":"AD","ccn3":"020","latlng":[42.5,1.5]},{"cca2":"AE","ccn3":"784","latlng":[24,54]},{"cca2":"AR","ccn3":"032","latlng":[-34,-64]},{"cca2":"AM","ccn3":"051","latlng":[40,45]},{"cca2":"AS","ccn3":"016","latlng":[-14.33333333,-170]},{"cca2":"AQ","ccn3":"010","latlng":[-90,0]},{"cca2":"TF","ccn3":"260","latlng":[-49.25,69.167]},{"cca2":"AG","ccn3":"028","latlng":[17.05,-61.8]},{"cca2":"AU","ccn3":"036","latlng":[-27,133]},{"cca2":"AT","ccn3":"040","latlng":[47.33333333,13.33333333]},{"cca2":"AZ","ccn3":"031","latlng":[40.5,47.5]},{"cca2":"BI","ccn3":"108","latlng":[-3.5,30]},{"cca2":"BE","ccn3":"056","latlng":[50.83333333,4]},{"cca2":"BJ","ccn3":"204","latlng":[9.5,2.25]},{"cca2":"BF","ccn3":"854","latlng":[13,-2]},{"cca2":"BD","ccn3":"050","latlng":[24,90]},{"cca2":"BG","ccn3":"100","latlng":[43,25]},{"cca2":"BH","ccn3":"048","latlng":[26,50.55]},{"cca2":"BS","ccn3":"044","latlng":[24.25,-76]},{"cca2":"BA","ccn3":"070","latlng":[44,18]},{"cca2":"BL","ccn3":"652","latlng":[18.5,-63.41666666]},{"cca2":"SH","ccn3":"654","latlng":[-15.95,-5.72]},{"cca2":"BY","ccn3":"112","latlng":[53,28]},{"cca2":"BZ","ccn3":"084","latlng":[17.25,-88.75]},{"cca2":"BM","ccn3":"060","latlng":[32.33333333,-64.75]},{"cca2":"BO","ccn3":"068","latlng":[-17,-65]},{"cca2":"BQ","ccn3":"535","latlng":[12.18,-68.25]},{"cca2":"BR","ccn3":"076","latlng":[-10,-55]},{"cca2":"BB","ccn3":"052","latlng":[13.16666666,-59.53333333]},{"cca2":"BN","ccn3":"096","latlng":[4.5,114.66666666]},{"cca2":"BT","ccn3":"064","latlng":[27.5,90.5]},{"cca2":"BV","ccn3":"074","latlng":[-54.43333333,3.4]},{"cca2":"BW","ccn3":"072","latlng":[-22,24]},{"cca2":"CF","ccn3":"140","latlng":[7,21]},{"cca2":"CA","ccn3":"124","latlng":[60,-95]},{"cca2":"CC","ccn3":"166","latlng":[-12.5,96.83333333]},{"cca2":"CH","ccn3":"756","latlng":[47,8]},{"cca2":"CL","ccn3":"152","latlng":[-30,-71]},{"cca2":"CN","ccn3":"156","latlng":[35,105]},{"cca2":"CI","ccn3":"384","latlng":[8,-5]},{"cca2":"CM","ccn3":"120","latlng":[6,12]},{"cca2":"CD","ccn3":"180","latlng":[0,25]},{"cca2":"CG","ccn3":"178","latlng":[-1,15]},{"cca2":"CK","ccn3":"184","latlng":[-21.23333333,-159.76666666]},{"cca2":"CO","ccn3":"170","latlng":[4,-72]},{"cca2":"KM","ccn3":"174","latlng":[-12.16666666,44.25]},{"cca2":"CV","ccn3":"132","latlng":[16,-24]},{"cca2":"CR","ccn3":"188","latlng":[10,-84]},{"cca2":"CU","ccn3":"192","latlng":[21.5,-80]},{"cca2":"CW","ccn3":"531","latlng":[12.116667,-68.933333]},{"cca2":"CX","ccn3":"162","latlng":[-10.5,105.66666666]},{"cca2":"KY","ccn3":"136","latlng":[19.5,-80.5]},{"cca2":"CY","ccn3":"196","latlng":[35,33]},{"cca2":"CZ","ccn3":"203","latlng":[49.75,15.5]},{"cca2":"DE","ccn3":"276","latlng":[51,9]},{"cca2":"DJ","ccn3":"262","latlng":[11.5,43]},{"cca2":"DM","ccn3":"212","latlng":[15.41666666,-61.33333333]},{"cca2":"DK","ccn3":"208","latlng":[56,10]},{"cca2":"DO","ccn3":"214","latlng":[19,-70.66666666]},{"cca2":"DZ","ccn3":"012","latlng":[28,3]},{"cca2":"EC","ccn3":"218","latlng":[-2,-77.5]},{"cca2":"EG","ccn3":"818","latlng":[27,30]},{"cca2":"ER","ccn3":"232","latlng":[15,39]},{"cca2":"EH","ccn3":"732","latlng":[24.5,-13]},{"cca2":"ES","ccn3":"724","latlng":[40,-4]},{"cca2":"EE","ccn3":"233","latlng":[59,26]},{"cca2":"ET","ccn3":"231","latlng":[8,38]},{"cca2":"FI","ccn3":"246","latlng":[64,26]},{"cca2":"FJ","ccn3":"242","latlng":[-18,175]},{"cca2":"FK","ccn3":"238","latlng":[-51.75,-59]},{"cca2":"FR","ccn3":"250","latlng":[46,2]},{"cca2":"FO","ccn3":"234","latlng":[62,-7]},{"cca2":"FM","ccn3":"583","latlng":[6.91666666,158.25]},{"cca2":"GA","ccn3":"266","latlng":[-1,11.75]},{"cca2":"GB","ccn3":"826","latlng":[54,-2]},{"cca2":"GE","ccn3":"268","latlng":[42,43.5]},{"cca2":"GG","ccn3":"831","latlng":[49.46666666,-2.58333333]},{"cca2":"GH","ccn3":"288","latlng":[8,-2]},{"cca2":"GI","ccn3":"292","latlng":[36.13333333,-5.35]},{"cca2":"GN","ccn3":"324","latlng":[11,-10]},{"cca2":"GP","ccn3":"312","latlng":[16.25,-61.583333]},{"cca2":"GM","ccn3":"270","latlng":[13.46666666,-16.56666666]},{"cca2":"GW","ccn3":"624","latlng":[12,-15]},{"cca2":"GQ","ccn3":"226","latlng":[2,10]},{"cca2":"GR","ccn3":"300","latlng":[39,22]},{"cca2":"GD","ccn3":"308","latlng":[12.11666666,-61.66666666]},{"cca2":"GL","ccn3":"304","latlng":[72,-40]},{"cca2":"GT","ccn3":"320","latlng":[15.5,-90.25]},{"cca2":"GF","ccn3":"254","latlng":[4,-53]},{"cca2":"GU","ccn3":"316","latlng":[13.46666666,144.78333333]},{"cca2":"GY","ccn3":"328","latlng":[5,-59]},{"cca2":"HK","ccn3":"344","latlng":[22.267,114.188]},{"cca2":"HM","ccn3":"334","latlng":[-53.1,72.51666666]},{"cca2":"HN","ccn3":"340","latlng":[15,-86.5]},{"cca2":"HR","ccn3":"191","latlng":[45.16666666,15.5]},{"cca2":"HT","ccn3":"332","latlng":[19,-72.41666666]},{"cca2":"HU","ccn3":"348","latlng":[47,20]},{"cca2":"ID","ccn3":"360","latlng":[-5,120]},{"cca2":"IM","ccn3":"833","latlng":[54.25,-4.5]},{"cca2":"IN","ccn3":"356","latlng":[20,77]},{"cca2":"IO","ccn3":"086","latlng":[-6,71.5]},{"cca2":"IE","ccn3":"372","latlng":[53,-8]},{"cca2":"IR","ccn3":"364","latlng":[32,53]},{"cca2":"IQ","ccn3":"368","latlng":[33,44]},{"cca2":"IS","ccn3":"352","latlng":[65,-18]},{"cca2":"IL","ccn3":"376","latlng":[31.47,35.13]},{"cca2":"IT","ccn3":"380","latlng":[42.83333333,12.83333333]},{"cca2":"JM","ccn3":"388","latlng":[18.25,-77.5]},{"cca2":"JE","ccn3":"832","latlng":[49.25,-2.16666666]},{"cca2":"JO","ccn3":"400","latlng":[31,36]},{"cca2":"JP","ccn3":"392","latlng":[36,138]},{"cca2":"KZ","ccn3":"398","latlng":[48,68]},{"cca2":"KE","ccn3":"404","latlng":[1,38]},{"cca2":"KG","ccn3":"417","latlng":[41,75]},{"cca2":"KH","ccn3":"116","latlng":[13,105]},{"cca2":"KI","ccn3":"296","latlng":[1.41666666,173]},{"cca2":"KN","ccn3":"659","latlng":[17.33333333,-62.75]},{"cca2":"KR","ccn3":"410","latlng":[37,127.5]},{"cca2":"XK","ccn3":"","latlng":[42.666667,21.166667]},{"cca2":"KW","ccn3":"414","latlng":[29.5,45.75]},{"cca2":"LA","ccn3":"418","latlng":[18,105]},{"cca2":"LB","ccn3":"422","latlng":[33.83333333,35.83333333]},{"cca2":"LR","ccn3":"430","latlng":[6.5,-9.5]},{"cca2":"LY","ccn3":"434","latlng":[25,17]},{"cca2":"LC","ccn3":"662","latlng":[13.88333333,-60.96666666]},{"cca2":"LI","ccn3":"438","latlng":[47.26666666,9.53333333]},{"cca2":"LK","ccn3":"144","latlng":[7,81]},{"cca2":"LS","ccn3":"426","latlng":[-29.5,28.5]},{"cca2":"LT","ccn3":"440","latlng":[56,24]},{"cca2":"LU","ccn3":"442","latlng":[49.75,6.16666666]},{"cca2":"LV","ccn3":"428","latlng":[57,25]},{"cca2":"MO","ccn3":"446","latlng":[22.16666666,113.55]},{"cca2":"MF","ccn3":"663","latlng":[18.08333333,-63.95]},{"cca2":"MA","ccn3":"504","latlng":[32,-5]},{"cca2":"MC","ccn3":"492","latlng":[43.73333333,7.4]},{"cca2":"MD","ccn3":"498","latlng":[47,29]},{"cca2":"MG","ccn3":"450","latlng":[-20,47]},{"cca2":"MV","ccn3":"462","latlng":[3.25,73]},{"cca2":"MX","ccn3":"484","latlng":[23,-102]},{"cca2":"MH","ccn3":"584","latlng":[9,168]},{"cca2":"MK","ccn3":"807","latlng":[41.83333333,22]},{"cca2":"ML","ccn3":"466","latlng":[17,-4]},{"cca2":"MT","ccn3":"470","latlng":[35.83333333,14.58333333]},{"cca2":"MM","ccn3":"104","latlng":[22,98]},{"cca2":"ME","ccn3":"499","latlng":[42.5,19.3]},{"cca2":"MN","ccn3":"496","latlng":[46,105]},{"cca2":"MP","ccn3":"580","latlng":[15.2,145.75]},{"cca2":"MZ","ccn3":"508","latlng":[-18.25,35]},{"cca2":"MR","ccn3":"478","latlng":[20,-12]},{"cca2":"MS","ccn3":"500","latlng":[16.75,-62.2]},{"cca2":"MQ","ccn3":"474","latlng":[14.666667,-61]},{"cca2":"MU","ccn3":"480","latlng":[-20.28333333,57.55]},{"cca2":"MW","ccn3":"454","latlng":[-13.5,34]},{"cca2":"MY","ccn3":"458","latlng":[2.5,112.5]},{"cca2":"YT","ccn3":"175","latlng":[-12.83333333,45.16666666]},{"cca2":"NA","ccn3":"516","latlng":[-22,17]},{"cca2":"NC","ccn3":"540","latlng":[-21.5,165.5]},{"cca2":"NE","ccn3":"562","latlng":[16,8]},{"cca2":"NF","ccn3":"574","latlng":[-29.03333333,167.95]},{"cca2":"NG","ccn3":"566","latlng":[10,8]},{"cca2":"NI","ccn3":"558","latlng":[13,-85]},{"cca2":"NU","ccn3":"570","latlng":[-19.03333333,-169.86666666]},{"cca2":"NL","ccn3":"528","latlng":[52.5,5.75]},{"cca2":"NO","ccn3":"578","latlng":[62,10]},{"cca2":"NP","ccn3":"524","latlng":[28,84]},{"cca2":"NR","ccn3":"520","latlng":[-0.53333333,166.91666666]},{"cca2":"NZ","ccn3":"554","latlng":[-41,174]},{"cca2":"OM","ccn3":"512","latlng":[21,57]},{"cca2":"PK","ccn3":"586","latlng":[30,70]},{"cca2":"PA","ccn3":"591","latlng":[9,-80]},{"cca2":"PN","ccn3":"612","latlng":[-25.06666666,-130.1]},{"cca2":"PE","ccn3":"604","latlng":[-10,-76]},{"cca2":"PH","ccn3":"608","latlng":[13,122]},{"cca2":"PW","ccn3":"585","latlng":[7.5,134.5]},{"cca2":"PG","ccn3":"598","latlng":[-6,147]},{"cca2":"PL","ccn3":"616","latlng":[52,20]},{"cca2":"PR","ccn3":"630","latlng":[18.25,-66.5]},{"cca2":"KP","ccn3":"408","latlng":[40,127]},{"cca2":"PT","ccn3":"620","latlng":[39.5,-8]},{"cca2":"PY","ccn3":"600","latlng":[-23,-58]},{"cca2":"PS","ccn3":"275","latlng":[31.9,35.2]},{"cca2":"PF","ccn3":"258","latlng":[-15,-140]},{"cca2":"QA","ccn3":"634","latlng":[25.5,51.25]},{"cca2":"RE","ccn3":"638","latlng":[-21.15,55.5]},{"cca2":"RO","ccn3":"642","latlng":[46,25]},{"cca2":"RU","ccn3":"643","latlng":[60,100]},{"cca2":"RW","ccn3":"646","latlng":[-2,30]},{"cca2":"SA","ccn3":"682","latlng":[25,45]},{"cca2":"SD","ccn3":"729","latlng":[15,30]},{"cca2":"SN","ccn3":"686","latlng":[14,-14]},{"cca2":"SG","ccn3":"702","latlng":[1.36666666,103.8]},{"cca2":"GS","ccn3":"239","latlng":[-54.5,-37]},{"cca2":"SJ","ccn3":"744","latlng":[78,20]},{"cca2":"SB","ccn3":"090","latlng":[-8,159]},{"cca2":"SL","ccn3":"694","latlng":[8.5,-11.5]},{"cca2":"SV","ccn3":"222","latlng":[13.83333333,-88.91666666]},{"cca2":"SM","ccn3":"674","latlng":[43.76666666,12.41666666]},{"cca2":"SO","ccn3":"706","latlng":[10,49]},{"cca2":"PM","ccn3":"666","latlng":[46.83333333,-56.33333333]},{"cca2":"RS","ccn3":"688","latlng":[44,21]},{"cca2":"SS","ccn3":"728","latlng":[7,30]},{"cca2":"ST","ccn3":"678","latlng":[1,7]},{"cca2":"SR","ccn3":"740","latlng":[4,-56]},{"cca2":"SK","ccn3":"703","latlng":[48.66666666,19.5]},{"cca2":"SI","ccn3":"705","latlng":[46.11666666,14.81666666]},{"cca2":"SE","ccn3":"752","latlng":[62,15]},{"cca2":"SZ","ccn3":"748","latlng":[-26.5,31.5]},{"cca2":"SX","ccn3":"534","latlng":[18.033333,-63.05]},{"cca2":"SC","ccn3":"690","latlng":[-4.58333333,55.66666666]},{"cca2":"SY","ccn3":"760","latlng":[35,38]},{"cca2":"TC","ccn3":"796","latlng":[21.75,-71.58333333]},{"cca2":"TD","ccn3":"148","latlng":[15,19]},{"cca2":"TG","ccn3":"768","latlng":[8,1.16666666]},{"cca2":"TH","ccn3":"764","latlng":[15,100]},{"cca2":"TJ","ccn3":"762","latlng":[39,71]},{"cca2":"TK","ccn3":"772","latlng":[-9,-172]},{"cca2":"TM","ccn3":"795","latlng":[40,60]},{"cca2":"TL","ccn3":"626","latlng":[-8.83333333,125.91666666]},{"cca2":"TO","ccn3":"776","latlng":[-20,-175]},{"cca2":"TT","ccn3":"780","latlng":[11,-61]},{"cca2":"TN","ccn3":"788","latlng":[34,9]},{"cca2":"TR","ccn3":"792","latlng":[39,35]},{"cca2":"TV","ccn3":"798","latlng":[-8,178]},{"cca2":"TW","ccn3":"158","latlng":[23.5,121]},{"cca2":"TZ","ccn3":"834","latlng":[-6,35]},{"cca2":"UG","ccn3":"800","latlng":[1,32]},{"cca2":"UA","ccn3":"804","latlng":[49,32]},{"cca2":"UM","ccn3":"581","latlng":[19.3,166.633333]},{"cca2":"UY","ccn3":"858","latlng":[-33,-56]},{"cca2":"US","ccn3":"840","latlng":[38,-97]},{"cca2":"UZ","ccn3":"860","latlng":[41,64]},{"cca2":"VA","ccn3":"336","latlng":[41.9,12.45]},{"cca2":"VC","ccn3":"670","latlng":[13.25,-61.2]},{"cca2":"VE","ccn3":"862","latlng":[8,-66]},{"cca2":"VG","ccn3":"092","latlng":[18.431383,-64.62305]},{"cca2":"VI","ccn3":"850","latlng":[18.35,-64.933333]},{"cca2":"VN","ccn3":"704","latlng":[16.16666666,107.83333333]},{"cca2":"VU","ccn3":"548","latlng":[-16,167]},{"cca2":"WF","ccn3":"876","latlng":[-13.3,-176.2]},{"cca2":"WS","ccn3":"882","latlng":[-13.58333333,-172.33333333]},{"cca2":"YE","ccn3":"887","latlng":[15,48]},{"cca2":"ZA","ccn3":"710","latlng":[-29,24]},{"cca2":"ZM","ccn3":"894","latlng":[-15,30]},{"cca2":"ZW","ccn3":"716","latlng":[-20,30]}];
const numericCodes = new Map(metadata.filter(country => country.ccn3).map(country => [country.ccn3!.padStart(3, "0"), country.cca2]));
const coordinates = new Map(metadata.map(country => [country.cca2, country.latlng]));
const topology = atlas as unknown as Topology<{ countries: GeometryCollection }>;
const geometries = feature(topology, topology.objects.countries).features;
const projection = geoNaturalEarth1().fitExtent([[12, 12], [WIDTH - 12, HEIGHT - 12]], { type: "Sphere" });
const drawPath = geoPath(projection);
const flagAssets = import.meta.glob("../node_modules/flag-icons/flags/4x3/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const flagUrl = (code: string) => flagAssets["../node_modules/flag-icons/flags/4x3/" + code.toLowerCase() + ".svg"];

function normalizeBoundary(input: Feature): Feature {
  if (geoArea(input) <= 2 * Math.PI) return input;
  const geometry = input.geometry;
  if (geometry.type === "Polygon") return { ...input, geometry: { ...geometry, coordinates: geometry.coordinates.map(ring => [...ring].reverse()) } };
  if (geometry.type === "MultiPolygon") return { ...input, geometry: { ...geometry, coordinates: geometry.coordinates.map(polygon => polygon.map(ring => [...ring].reverse())) } };
  return input;
}

const boundaryCollection = ukraineBoundary as unknown as FeatureCollection;
const ukraine: Feature = normalizeBoundary({
  type: "Feature",
  properties: { name: "Ukraine" },
  geometry: {
    type: "MultiPolygon",
    coordinates: boundaryCollection.features.flatMap(item => item.geometry.type === "Polygon"
      ? [item.geometry.coordinates]
      : item.geometry.type === "MultiPolygon" ? item.geometry.coordinates : []),
  },
});
const ukrainePath = drawPath(ukraine) || "";

const mapShapes = geometries.map(item => {
  const code = numericCodes.get(String(item.id).padStart(3, "0")) || ((item.properties as { name?: string } | null)?.name === "Kosovo" ? "XK" : "");
  const shape = code === "UA" ? ukraine : item;
  const centroid = projection(geoCentroid(shape));
  return { code, shape, path: drawPath(shape as Feature<Geometry>) || "", area: geoArea(shape), centroid };
}).sort((a, b) => Number(a.code === "UA") - Number(b.code === "UA"));
const mappedCodes = new Set(mapShapes.map(shape => shape.code));

function clampView(view: View): View {
  return { ...view, x: Math.max(-WIDTH * (view.scale - 1), Math.min(0, view.x)), y: Math.max(-HEIGHT * (view.scale - 1), Math.min(0, view.y)) };
}

export function WorldIngredientMap({ countries, selected, onChange }: Props) {
  const maskId = "ukraine-mask-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [allLabels, setAllLabels] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewportWidth,setViewportWidth]=useState(WIDTH);
  useEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    const observer=new ResizeObserver(entries=>setViewportWidth(entries[0]?.contentRect.width||WIDTH));
    observer.observe(svg);return ()=>observer.disconnect();
  },[]);
  const labelScale=Math.max(1,WIDTH/viewportWidth);
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, x: 0, y: 0 });
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const byCode = useMemo(() => new Map(countries.map(country => [country.code, country])), [countries]);
  const countryList = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("uk");
    return [...countries].sort((a, b) => a.name.localeCompare(b.name, "uk")).filter(country => !search || country.name.toLocaleLowerCase("uk").includes(search) || country.code.toLowerCase().includes(search));
  }, [countries, query]);
  const markers = useMemo(() => countries.flatMap(country => {
    const shape = mapShapes.find(item => item.code === country.code);
    if (mappedCodes.has(country.code) && shape && shape.area >= 0.00015) return [];
    const latlng = coordinates.get(country.code);
    const point = latlng ? projection([latlng[1], latlng[0]]) : shape?.centroid;
    return point ? [{ country, point }] : [];
  }), [countries]);
  const active = hovered ? byCode.get(hovered) : null;
  const toggle = (code: string) => onChange(selectedSet.has(code) ? selected.filter(item => item !== code) : [...selected, code]);
  const activateMap = (code: string) => { if (!drag.current.moved) toggle(code); };
  const zoom = (factor: number) => setView(current => {
    const scale = Math.max(1, Math.min(8, current.scale * factor));
    const ratio = scale / current.scale;
    return clampView({ scale, x: WIDTH / 2 - (WIDTH / 2 - current.x) * ratio, y: HEIGHT / 2 - (HEIGHT / 2 - current.y) * ratio });
  });
  const label = (country: CountryOption, point: [number, number], key: string) => (
    <g key={key} className="world-ingredient-map__label" transform={"translate(" + point[0] + " " + point[1] + ") scale(" + labelScale / view.scale + ")"} aria-hidden="true">
      {flagUrl(country.code) && <image href={flagUrl(country.code)} x="-10" y="-30" width="20" height="14" />}
      <text textAnchor="middle"><tspan x="0" y="-3">{country.name}</tspan><tspan className="world-ingredient-map__label-count" x="0" y="10">{country.count} інгр.</tspan></text>
    </g>
  );

  return <section className="world-ingredient-map" aria-label="Вибір країн на карті">
    <div className="world-ingredient-map__toolbar">
      <div className="world-ingredient-map__zoom" aria-label="Масштаб карти">
        <button type="button" onClick={() => zoom(1.5)} disabled={view.scale >= 8} aria-label="Збільшити карту">+</button>
        <button type="button" onClick={() => zoom(1 / 1.5)} disabled={view.scale <= 1} aria-label="Зменшити карту">−</button>
        <button type="button" onClick={() => setView({ scale: 1, x: 0, y: 0 })}>Увесь світ</button>
      </div>
      <label className="world-ingredient-map__label-toggle"><input type="checkbox" checked={allLabels} onChange={event => setAllLabels(event.target.checked)} />Назви всіх країн</label>
      {!!selected.length && <button type="button" className="world-ingredient-map__clear" onClick={() => onChange([])}>Скинути країни ({selected.length})</button>}
    </div>
    <div className="world-ingredient-map__canvas">
      <svg ref={svgRef} className="world-ingredient-map__svg" viewBox={"0 0 " + WIDTH + " " + HEIGHT} role="group" aria-label="Інтерактивна карта світу. Оберіть одну або декілька країн"
        onPointerDown={event => {
          if (event.button !== 0) return;
          drag.current = { active: true, moved: false, startX: event.clientX, startY: event.clientY, x: view.x, y: view.y };
        }}
        onPointerMove={event => {
          if (!drag.current.active) return;
          const deltaX = event.clientX - drag.current.startX;
          const deltaY = event.clientY - drag.current.startY;
          if (Math.abs(deltaX) + Math.abs(deltaY) > 5) {
            drag.current.moved = true;
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (!drag.current.moved) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setView(clampView({ scale: view.scale, x: drag.current.x + deltaX * WIDTH / rect.width, y: drag.current.y + deltaY * HEIGHT / rect.height }));
        }}
        onPointerUp={event => {
          drag.current.active = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current.active = false; }}
        onPointerLeave={() => { if (!drag.current.active) setHovered(null); }}
      >
        <defs><mask id={maskId} maskUnits="userSpaceOnUse"><rect width={WIDTH} height={HEIGHT} fill="white" /><path d={ukrainePath} fill="black" /></mask></defs>
        <rect className="world-ingredient-map__ocean" width={WIDTH} height={HEIGHT} />
        <g transform={"translate(" + view.x + " " + view.y + ") scale(" + view.scale + ")"}>
          {mapShapes.map((shape, index) => {
            const country = byCode.get(shape.code);
            if (!country) return <path key={"land-" + index} d={shape.path} className="world-ingredient-map__land world-ingredient-map__land--unknown" aria-hidden="true" />;
            return <path key={shape.code} d={shape.path} mask={shape.code === "RU" ? "url(#" + maskId + ")" : undefined}
              data-country-code={shape.code} className={"world-ingredient-map__land" + (country.count ? " has-products" : "") + (selectedSet.has(shape.code) ? " is-selected" : "")}
              role="button" tabIndex={0} aria-pressed={selectedSet.has(shape.code)} aria-label={country.name + ": " + country.count + " інгредієнтів"}
              onClick={() => activateMap(shape.code)}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(shape.code); } }}
              onPointerEnter={() => setHovered(shape.code)} onFocus={() => setHovered(shape.code)} onBlur={() => setHovered(null)}
            ><title>{country.name + " · " + country.count + " інгредієнтів"}</title></path>;
          })}
          {markers.map(({ country, point }) => <circle key={"marker-" + country.code} cx={point[0]} cy={point[1]} r={3.6 * labelScale / Math.sqrt(view.scale)}
            className={"world-ingredient-map__marker" + (selectedSet.has(country.code) ? " is-selected" : "")}
            data-country-code={country.code} role="button" tabIndex={0} aria-pressed={selectedSet.has(country.code)} aria-label={country.name + ": " + country.count + " інгредієнтів"}
            onClick={() => activateMap(country.code)} onPointerEnter={() => setHovered(country.code)} onFocus={() => setHovered(country.code)} onBlur={() => setHovered(null)}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(country.code); } }}
          ><title>{country.name + " · " + country.count + " інгредієнтів"}</title></circle>)}
          {mapShapes.map(shape => {
            const country = byCode.get(shape.code);
            const visible = allLabels || hovered === shape.code || selectedSet.has(shape.code) || ((viewportWidth>=600||view.scale>=3)&&shape.area > (view.scale > 1.5 ? 0.005 / view.scale : 0.05));
            return country && shape.centroid && visible ? label(country, shape.centroid, "label-" + shape.code) : null;
          })}
          {markers.map(({ country, point }) => (allLabels || hovered === country.code || selectedSet.has(country.code)) && !mappedCodes.has(country.code) ? label(country, point, "tiny-label-" + country.code) : null)}
        </g>
      </svg>
      <div className="world-ingredient-map__caption" aria-live="polite">
        {active ? <><img className="world-ingredient-map__flag" src={flagUrl(active.code)} alt="" /> <strong>{active.name}</strong><span>{active.count} інгредієнтів</span></> : <span>Натисніть країни для вибору. Збільшуйте та перетягуйте карту, щоб роздивитися деталі.</span>}
      </div>
    </div>
    {!!selected.length && <div className="world-ingredient-map__selected" aria-label="Обрані країни">
      {selected.map(code => { const country = byCode.get(code); return country ? <button type="button" key={code} onClick={() => toggle(code)} aria-label={"Прибрати країну " + country.name}><img className="world-ingredient-map__flag" src={flagUrl(code)} alt="" loading="lazy" />{country.name}<span aria-hidden="true">×</span></button> : null; })}
    </div>}
    <label className="world-ingredient-map__search">Пошук країни<input type="search" placeholder="Назва або код країни..." value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="world-ingredient-map__countries" aria-label="Усі країни">
      {countryList.map(country => <label className={"world-ingredient-map__country-option" + (selectedSet.has(country.code) ? " is-selected" : "")} key={country.code} data-country-code={country.code}>
        <input type="checkbox" aria-label={"Країна " + country.name} checked={selectedSet.has(country.code)} onChange={() => toggle(country.code)} />
        <img className="world-ingredient-map__flag" src={flagUrl(country.code)} alt="" loading="lazy" />
        <span className="world-ingredient-map__country-name">{country.name}</span><span className="world-ingredient-map__count">{country.count}</span>
      </label>)}
      {!countryList.length && <p className="world-ingredient-map__empty">Країн не знайдено.</p>}
    </div>
    <p className="world-ingredient-map__hint">Обирайте країни на карті або у списку. Кількість враховує пошук і категорії; 0 — немає відповідних позначених продуктів.</p>
    <p className="world-ingredient-map__sources">Карта: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>. Межі України: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a>.</p>
  </section>;
}



