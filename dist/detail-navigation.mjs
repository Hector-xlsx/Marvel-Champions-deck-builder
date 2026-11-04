/** Keep the source order stable while quantities or preferred groups change. */
export class DetailNavigation{
  constructor(source,codes,current){this.source=source;this.codes=[...new Set(codes)];this.index=Math.max(0,this.codes.indexOf(current));}
  select(code){const index=this.codes.indexOf(code);if(index>=0)this.index=index;else if(this.codes.length)this.codes[this.index]=code;}
  step(direction){if(!this.codes.length)return null;this.index=(this.index+Math.sign(direction)+this.codes.length)%this.codes.length;return this.codes[this.index];}
  get canNavigate(){return Boolean(this.source)&&this.codes.length>1;}
}
