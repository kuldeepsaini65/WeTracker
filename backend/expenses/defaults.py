from .models import Profile

# (name, icon, colour, comma-separated keywords) — add keywords inside the 4th string.
DEFAULT_CATEGORIES = [
    ('Food', '🍔', '#f97316', 'food,lunch,dinner,breakfast,snack,snacks,restaurant,swiggy,zomato,pizza,burger,meal,eat,biryani,roti'),
    ('Coffee & Tea', '☕', '#a16207', 'coffee,tea,chai,cafe,starbucks,latte'),
    ('Groceries', '🛒', '#22c55e', 'grocery,groceries,vegetables,veggies,fruits,milk,bread,eggs,supermarket,blinkit,zepto,bigbasket'),
    ('Transport', '🚕', '#3b82f6', 'uber,ola,cab,taxi,auto,bus,metro,train,rapido,parking,toll,travel,ride,bla bla'),
    ('Fuel', '⛽', '#ef4444', 'fuel,petrol,diesel,gas,cng'),
    ('Shopping', '🛍️', '#ec4899', 'shopping,clothes,shoes,amazon,flipkart,myntra,shirt,jeans'),
    ('Bills', '💡', '#eab308', 'bill,bills,electricity,water,internet,wifi,broadband,recharge,mobile,phone,rent,gas bill'),
    ('Health', '💊', '#14b8a6', 'medicine,medicines,doctor,pharmacy,hospital,gym,health,clinic'),
    ('Entertainment', '🎬', '#8b5cf6', 'movie,movies,netflix,spotify,prime,game,games,concert,party'),
    ('Other', '📦', '#64748b', ''),
    ('Party', '🍾', "#ac4535", 'daru,daaru,namkeen,bhujiya'),
    ('Cigret', '🚬', "#2acce1", 'ciggret,sutta,dhuma,dhua,bidi,advance'),
]


def setup_new_user(user):
    from .teams import ensure_default_categories

    Profile.objects.get_or_create(user=user)
    ensure_default_categories(user)
