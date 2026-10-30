# LEGACY SEED SCRIPT. DO NOT RERUN.
# prices.json is now the canonical source of truth. Rows are hand-verified from public store pages
# (estimated=false + exact source_url) and refreshed in place each week. Rerunning this script would
# overwrite the verified prices with synthetic estimates. It is kept only to document how the
# original 2026-10-18 estimates were generated.
import json,hashlib
# item: (kroger product, size_label, grams, kroger_price, unit_kind)
B={
'chicken_breast':('Boneless skinless chicken breast (value pack)','3 lb',1361,8.97,'lb'),
'chicken_thigh':('Boneless skinless chicken thighs (value pack)','3 lb',1361,8.37,'lb'),
'ground_turkey':('Ground turkey 93% lean','1 lb',454,5.49,'lb'),
'ground_beef':('Ground beef 85% lean','1 lb',454,5.99,'lb'),
'tuna':('Chunk light tuna in water','5 oz can',142,1.19,'oz'),
'salmon':('Atlantic salmon fillets, frozen','2 lb',907,14.99,'lb'),
'tilapia':('Tilapia fillets, frozen','2 lb',907,9.99,'lb'),
'eggs':('Large white eggs','12 ct',600,3.29,'ct'),
'egg_whites':('100% liquid egg whites','32 oz',907,4.79,'oz'),
'greek_yogurt':('Plain nonfat Greek yogurt','32 oz',907,5.29,'oz'),
'cottage_cheese':('Low-fat cottage cheese','24 oz',680,3.79,'oz'),
'cheddar':('Shredded mild cheddar','8 oz',227,2.79,'oz'),
'mozzarella':('Shredded part-skim mozzarella','8 oz',227,2.79,'oz'),
'milk':('1% lowfat milk','½ gal',1950,2.49,'floz'),
'whey':('Whey protein powder, vanilla','2 lb',907,29.99,'oz'),
'black_beans':('Black beans','15.5 oz can',260,0.99,'oz'),
'chickpeas':('Garbanzo beans','15.5 oz can',260,1.09,'oz'),
'lentils':('Brown lentils','1 lb',454,1.89,'lb'),
'rice_white':('Long grain white rice','5 lb',2268,5.49,'lb'),
'quinoa':('White quinoa','16 oz',454,4.99,'lb'),
'oats':('Old fashioned oats','42 oz',1191,4.99,'oz'),
'pasta':('Penne pasta','16 oz',454,1.39,'lb'),
'tortillas':('Burrito flour tortillas','8 ct',560,3.29,'ct'),
'bread':('100% whole wheat bread','20 oz',567,2.99,'oz'),
'potatoes':('Russet potatoes','5 lb bag',2268,4.49,'lb'),
'sweet_potato':('Sweet potatoes, loose','per lb',453.6,1.29,'lb'),
'broccoli':('Frozen broccoli florets','12 oz',340,1.79,'oz'),
'mixed_veg':('Frozen mixed vegetables','12 oz',340,1.49,'oz'),
'green_beans':('Frozen cut green beans','12 oz',340,1.49,'oz'),
'berries':('Frozen triple berry blend','16 oz',454,3.99,'oz'),
'spinach':('Baby spinach','10 oz',284,3.49,'oz'),
'bell_pepper':('Bell peppers, 3 ct','3 ct',480,3.99,'ct'),
'onion':('Yellow onions','3 lb bag',1361,2.99,'lb'),
'carrots':('Whole carrots','2 lb bag',907,1.99,'lb'),
'mushrooms':('White mushrooms, sliced','8 oz',227,2.29,'oz'),
'garlic':('Garlic, 3 ct','3 ct',150,1.49,'ct'),
'banana':('Bananas','each',120,0.25,'ea'),
'apple':('Gala apples','3 lb bag',1361,4.49,'lb'),
'peanut_butter':('Creamy peanut butter','16 oz',454,2.69,'oz'),
'almonds':('Whole almonds','16 oz',454,6.99,'oz'),
'olive_oil':('Extra virgin olive oil','16.9 fl oz',460,7.49,'floz'),
'salsa':('Medium chunky salsa','16 oz',454,2.79,'oz'),
'marinara':('Marinara pasta sauce','24 oz',680,2.29,'oz'),
'canned_tomatoes':('Crushed tomatoes','28 oz can',794,1.79,'oz'),
'soy_sauce':('Soy sauce','15 fl oz',444,2.49,'floz'),
'honey':('Pure clover honey','12 oz',340,4.49,'oz'),
}
S={'Aldi':(0.82,'https://www.aldi.us/','Aldi'),'Kroger':(1.0,'https://www.kroger.com/','Kroger'),
   'Meijer':(0.94,'https://www.meijer.com/','Meijer'),"Trader Joe's":(1.0,'https://www.traderjoes.com/',"Trader Joe's")}
skip={("Trader Joe's",'whey'),("Trader Joe's",'tilapia'),("Trader Joe's",'egg_whites')}
def j(s):  # deterministic jitter ±7%
    h=int(hashlib.md5(s.encode()).hexdigest()[:6],16)/0xFFFFFF; return 0.93+0.14*h
NOUN={'chicken_breast':'pack','chicken_thigh':'pack','ground_turkey':'pack','ground_beef':'pack','tuna':'can','salmon':'bag','tilapia':'bag',
'eggs':'dozen','egg_whites':'carton','greek_yogurt':'tub','cottage_cheese':'tub','cheddar':'bag','mozzarella':'bag','milk':'carton','whey':'tub',
'black_beans':'can','chickpeas':'can','lentils':'bag','rice_white':'bag','quinoa':'bag','oats':'box','pasta':'box','tortillas':'pack','bread':'loaf',
'potatoes':'bag','sweet_potato':'lb','broccoli':'bag','mixed_veg':'bag','green_beans':'bag','berries':'bag','spinach':'bag','bell_pepper':'pack',
'onion':'bag','carrots':'bag','mushrooms':'pack','garlic':'pack','banana':'banana','apple':'bag','peanut_butter':'jar','almonds':'bag',
'olive_oil':'bottle','salsa':'jar','marinara':'jar','canned_tomatoes':'can','soy_sauce':'bottle','honey':'bottle'}
COUNT={'eggs':(12,'egg'),'garlic':(3,'head'),'bell_pepper':(3,'pepper'),'tortillas':(8,'tortilla')}
OV={('Kroger','chicken_thigh'):5.97,('Meijer','ground_turkey'):4.49,('Kroger','eggs'):2.49,('Meijer','greek_yogurt'):4.29,('Kroger','broccoli'):1.25,('Meijer','rice_white'):4.29,('Meijer','salmon'):11.99}
out=[]
for item,(prod,size,g,kp,uk) in B.items():
    for st,(fac,url,brand) in S.items():
        if (st,item) in skip: continue
        p=kp if st=='Kroger' else kp*fac*j(st+item)
        p=round(int(p)+min(0.99,round((p-int(p))*10)/10+0.09),2) if st!='Kroger' else p
        p=OV.get((st,item),p)
        div={'lb':g/453.6,'oz':g/28.35,'floz':g/29.57,'ct':float(size.split()[0]) if uk=='ct' else 1,'ea':1}[uk]
        out.append(dict(item_id=item,store=st,product=f"{brand} {prod}",package_size=size,package_grams=g,
            price=p,unit_price=round(p/div,3),unit=('per '+{'floz':'fl oz','ea':'each'}.get(uk,uk)),package_noun=NOUN[item],count_per_package=COUNT.get(item,(None,))[0],count_noun=COUNT.get(item,(None,None))[1],
            aisle=None,last_updated='2026-10-18',estimated=True,source_url=url))
json.dump({"region":"Plymouth, MI 48170","note":"Estimated shelf prices for Oct 2026, not live quotes.","prices":out},open('prices.json','w'),indent=1)
print(len(out))
