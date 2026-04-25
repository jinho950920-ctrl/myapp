import itertools

sales = 885220
cogs = 169770
promo = 363000
comm_a = 6379.56
ship_a = 6918
ads_a = 308760
comm_b = 55660.176
ship_b = 86130
ads_b = 339636

items = {
    'sales': sales,
    'cogs': -cogs,
    'promo': -promo,
    'comm_a': -comm_a,
    'ship_a': -ship_a,
    'ads_a': -ads_a,
    'comm_b': -comm_b,
    'ship_b': -ship_b,
    'ads_b': -ads_b
}

keys = list(items.keys())
target = -142273.74

for L in range(1, len(keys) + 1):
    for subset in itertools.combinations(keys, L):
        val = sum(items[k] for k in subset)
        if abs(val - target) < 1:
            print("FOUND!", subset, '=', val)

