from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import random, sys
src, out, l1, l2 = sys.argv[1:5]
W,H=1080,1350
from PIL import ImageOps
im=ImageOps.exif_transpose(Image.open(src)).convert('RGB')
yf=float(sys.argv[5]) if len(sys.argv)>5 else 0.15
# manual crop: face center (fx,fy) in source px, head scale
fx,fy,sc=[float(v) for v in sys.argv[6:9]] if len(sys.argv)>8 else (im.width/2,im.height*0.35,W/im.width)
cw,ch=W/sc,H/sc; x0=max(0,min(im.width-cw,fx-cw/2)); y0=max(0,min(im.height-ch,fy-380/sc))
im=im.crop((int(x0),int(y0),int(x0+cw),int(y0+ch))).resize((W,H),Image.LANCZOS)
# tame bright corners (softbox)
lum=im.convert('L').point(lambda v:255 if v>235 else 0).filter(ImageFilter.GaussianBlur(40))
im=Image.composite(Image.new('RGB',(W,H),(60,66,80)),im,lum.point(lambda v:int(v*0.85)))
im=ImageEnhance.Contrast(im).enhance(1.05)
# vignette
vg=Image.new('L',(W,H),0); vd=ImageDraw.Draw(vg); vd.ellipse((-W*0.35,-H*0.25,W*1.35,H*1.1),fill=255); vg=vg.filter(ImageFilter.GaussianBlur(160))
im=Image.composite(im,Image.new('RGB',(W,H),(10,20,50)),vg)
# soft dark gradient at bottom for legibility
grad=Image.new('L',(1,H)); 
for j in range(H): grad.putpixel((0,j), int(max(0,(j-H*0.45)/(H*0.55))*190))
grad=grad.resize((W,H)); dark=Image.new('RGB',(W,H),(8,18,48)); im=Image.composite(dark,im,grad)
d=ImageDraw.Draw(im)
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def fit(t,maxw,start):
    sz=start
    while sz>30:
        f=ImageFont.truetype(F,sz,layout_engine=ImageFont.Layout.RAQM)
        if d.textlength(t,font=f,direction='rtl',language='ar')<=maxw: return f
        sz-=4
    return f
f1=fit(l1,W-160,92); f2=fit(l2,W-160,100)
# brush banner
by=int(H*0.70); bh=300
random.seed(3)
ban=Image.new('L',(W,H),0); bd=ImageDraw.Draw(ban)
pts=[]
for i in range(0,W+1,24): pts.append((i, by+random.randint(-14,10)))
for i in range(W,-1,-24): pts.append((i, by+bh+random.randint(-10,14)))
bd.polygon(pts,fill=255); ban=ban.filter(ImageFilter.GaussianBlur(1.2))
im.paste(Image.new('RGB',(W,H),(14,30,84)),(0,0),ban)
# yellow accent strip
d=ImageDraw.Draw(im)
d.rectangle((W//2-90,by-10,W//2+90,by-2),fill=(255,206,0))
def ctext(t,f,yc,fill):
    w=d.textlength(t,font=f,direction='rtl',language='ar')
    d.text(((W-w)/2+3,yc+3),t,font=f,fill=(0,0,0),direction='rtl',language='ar')
    d.text(((W-w)/2,yc),t,font=f,fill=fill,direction='rtl',language='ar')
ctext(l1,f1,by+42,(255,255,255))
ctext(l2,f2,by+152,(255,206,0))
fb=ImageFont.truetype(F,30)
d.text((40,H-58),'Dr. Ahmed Nabil  |  The Chemistry Magician',font=fb,fill=(230,230,230))
im.save(out,quality=92)
print(out)
