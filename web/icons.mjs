// Small monochrome icons share dimensions and remain independent of emoji fonts.
const paths={
  cards:'M6 2h9v12H6z M3 5H2v11h10v-1',
  deck:'M3 4h12 M3 9h12 M3 14h12 M1 4h.1 M1 9h.1 M1 14h.1',
  save:'M2 2h11l3 3v11H2z M5 2v5h7V2 M5 16v-6h8v6',
  view:'M2 3h14 M2 9h14 M2 15h14 M6 1v4 M12 7v4 M8 13v4',
  theme:'M15.7 11.5A7 7 0 0 1 6.5 2.3a7 7 0 1 0 9.2 9.2z M13 2v4 M11 4h4',
  settings:'M7 1.8h4l.5 2.1 1.4.8 2.1-.6 2 3.5-1.6 1.5v1.6l1.6 1.5-2 3.5-2.1-.6-1.4.8-.5 2.1H7l-.5-2.1-1.4-.8-2.1.6-2-3.5 1.6-1.5V9.1L1 7.6l2-3.5 2.1.6 1.4-.8z M11.5 9.9a2.5 2.5 0 1 0-5 0 2.5 2.5 0 1 0 5 0',
  reset:'M3 7a6 6 0 1 1 .5 5 M3 2v5h5',
  pin:'M5 2h8l-1.5 5 3 3v1H3.5v-1l3-3z M9 11v5',
  eye:'M1 9s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z M11 9a2 2 0 1 0-4 0 2 2 0 0 0 4 0',
  eyeOff:'M1 9s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z M2 2l14 14',
  hero:'M9 1.8 15 4v4.4c0 3.7-2.5 6.2-6 7.8-3.5-1.6-6-4.1-6-7.8V4z M6.5 6v5.5 M11.5 6v5.5 M6.5 8.8h5',
  energy:'M10.5 1.5 4.5 10h4l-1 6.5 6-9h-4z',
  physical:'M4 10V6.5a1.2 1.2 0 0 1 2.4 0V9 4a1.2 1.2 0 0 1 2.4 0v5-5.5a1.2 1.2 0 0 1 2.4 0V9 5a1.2 1.2 0 0 1 2.4 0v5.5l-1 5H6l-3-4a1.3 1.3 0 0 1 1-2z',
  mental:'M7 3a2.5 2.5 0 0 0-4 2 3 3 0 0 0-1 5 3 3 0 0 0 3 4 2.5 2.5 0 0 0 4 1V4a2.5 2.5 0 0 0-2-1z M11 3a2.5 2.5 0 0 1 4 2 3 3 0 0 1 1 5 3 3 0 0 1-3 4 2.5 2.5 0 0 1-4 1 M4 7l3 1 M3 11l3-1 M14 7l-3 1 M15 11l-3-1',
  wild:'M9 1.5v15 M1.5 9h15 M3.7 3.7l10.6 10.6 M3.7 14.3 14.3 3.7',
  single:'M9 1.8a7.2 7.2 0 1 0 0 14.4 7.2 7.2 0 0 0 0-14.4 M7 6.5 9 5v8 M7 13h4'
};
export function iconSvg(name){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  for(const [key,value]of Object.entries({viewBox:'0 0 18 18',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.4,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,String(value));
  const path=document.createElementNS(ns,'path');path.setAttribute('d',paths[name]||paths.wild);svg.append(path);return svg;
}
