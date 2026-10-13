from .models import Profile

# (name, icon, colour, comma-separated keywords) — add keywords inside the 4th string.
# English + Hinglish (Hindi written in English letters). A keyword can be several words, e.g. "vada pav".
# Categories are checked top to bottom and the first match wins, so a word must appear in only ONE category
# (a test enforces this).
DEFAULT_CATEGORIES = [
    ('Food', '🍔', '#f97316',
     'food,lunch,dinner,breakfast,snack,snacks,restaurant,swiggy,zomato,pizza,burger,meal,eat,biryani,roti,'
     'khana,khaana,nashta,nasta,thali,dhaba,chaat,samosa,kachori,paratha,parantha,dosa,idli,vada pav,pav bhaji,'
     'chole bhature,momos,maggi,paneer,rajma,tiffin,mess,canteen,jalebi,mithai,sweets,lassi,pani puri,golgappe'),
    ('Coffee & Tea', '☕', '#a16207',
     'coffee,tea,chai,chay,cafe,starbucks,latte,cutting chai,kadak chai,kulhad,adrak chai,tapri,ccd'),
    ('Groceries', '🛒', '#22c55e',
     'grocery,groceries,vegetables,veggies,fruits,milk,bread,eggs,supermarket,blinkit,zepto,bigbasket,'
     'sabzi,sabji,subzi,kirana,ration,doodh,dudh,atta,aata,chawal,dal,daal,aloo,pyaz,pyaaz,tamatar,anda,ande,'
     'masala,namak,cheeni,tel,ghee,dahi,makhan,dmart,jiomart,instamart'),
    ('Transport', '🚕', '#3b82f6',
     'uber,ola,cab,taxi,auto,bus,metro,train,rapido,parking,toll,travel,ride,'
     'rickshaw,riksha,erickshaw,toto,tempo,bhada,gaadi,local train,irctc,redbus,flight,yatra'),
    ('Fuel', '⛽', '#ef4444',
     'fuel,petrol,diesel,cng,petrol pump,tanki,full tank'),
    ('Shopping', '🛍️', '#ec4899',
     'shopping,clothes,shoes,amazon,flipkart,myntra,shirt,jeans,'
     'kapde,kapda,joote,juta,chappal,kurta,saree,sari,dupatta,bazaar,bazar,mall,meesho,ajio,nykaa'),
    ('Bills', '💡', '#eab308',
     'bill,bills,electricity,water,internet,wifi,broadband,recharge,mobile,phone,rent,gas bill,'
     'bijli,light bill,paani,pani bill,kiraya,kiraaya,gas cylinder,cylinder,lpg,dth,tata play,jio,airtel,'
     'maintenance,society,emi,kist'),
    ('Health', '💊', '#14b8a6',
     'medicine,medicines,doctor,pharmacy,hospital,gym,health,clinic,'
     'dawai,dawa,davai,dawakhana,chemist,medical,ilaaj,checkup,blood test,lab,daktar,vaid'),
    ('Entertainment', '🎬', '#8b5cf6',
     'movie,movies,netflix,spotify,prime,game,games,concert,'
     'picture,cinema,film,ott,hotstar,jiocinema,pvr,inox,mela'),
    ('Party', '🍾', '#ac4535',
     'party,daru,daaru,namkeen,bhujiya,sharab,sharaab,beer,peg,theka,thekka,whisky,rum,vodka,cheers,chakna,booze,pub'),
    ('Cigarettes', '🚬', '#2acce1',
     'cigarette,cigarettes,cig,ciggret,sutta,dhuma,dhooma,dhua,dhuan,bidi,beedi,gutka,gutkha,paan,tobacco,'
     'tambaku,khaini,hookah,vape,gold flake,marlboro'),
    ('Other', '📦', '#64748b', 'misc,miscellaneous,kuch'),
]


def setup_new_user(user):
    from .teams import ensure_default_categories

    Profile.objects.get_or_create(user=user)
    ensure_default_categories(user)
