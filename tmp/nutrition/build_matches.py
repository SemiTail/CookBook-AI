import json
from pathlib import Path
P=Path('tmp/nutrition');H=Path('scripts/nutrition')
foods=json.loads((P/'usda-foods.json').read_text(encoding='utf-8'))
specs='''Абрикос|Apricots, raw
Авокадо|Avocados, raw, all commercial varieties
Ананас|Pineapple, raw, all varieties
Апельсин|Oranges, raw, all commercial varieties
Банан|Bananas, raw
Гранат|Pomegranates, raw
Груша|Pears, raw
Гуава|Guavas, common, raw
Кавун|Watermelon, raw
Карамбола|Carambola, (starfruit), raw
Ківі|Kiwifruit, green, raw
Лайм|Limes, raw
Лимон|Lemons, raw, without peel
Лічі|Litchis, raw
Манго|Mangos, raw
Мандарин|Tangerines, (mandarin oranges), raw
Маракуя|Passion-fruit, (granadilla), purple, raw
Нектарин|Nectarines, raw
Папая|Papayas, raw
Персик|Peaches, yellow, raw
Помело|Pummelo, raw
Слива|Plums, raw
Яблуко|Apples, raw, with skin
Інжир свіжий|Figs, raw
Айва|Quinces, raw
Аґрус|Gooseberries, raw
Вишня|Cherries, sour, red, raw
Черешня|Cherries, sweet, raw
Журавлина|Cranberries, raw
Лохина|Blueberries, raw
Малина|Raspberries, raw
Ожина|Blackberries, raw
Полуниця|Strawberries, raw
Смородина червона|Currants, red and white, raw
Смородина біла|Currants, red and white, raw
Смородина чорна|Currants, european black, raw
Шовковиця|Mulberries, raw
Артишок|Artichokes, (globe or french), raw
Баклажан|Eggplant, raw
Батат|Sweet potato, raw, unprepared
Броколі|Broccoli, raw
Брюссельська капуста|Brussels sprouts, raw
Буряк|Beets, raw
Гарбуз|Pumpkin, raw
Капуста|Cabbage, raw
Капуста білокачанна|Cabbage, raw
Капуста кольрабі|Kohlrabi, raw
Капуста пекінська|Cabbage, chinese (pe-tsai), raw
Капуста савойська|Cabbage, savoy, raw
Капуста червонокачанна|Cabbage, red, raw
Картопля|Potatoes, flesh and skin, raw
Морква|Carrots, raw
Огірок|Cucumber, with peel, raw
Окра|Okra, raw
Пастернак|Parsnips, raw
Перець халапеньйо|Peppers, jalapeno, raw
Помідор|Tomatoes, red, ripe, raw, year round average
Ревінь|Rhubarb, raw
Редиска|Radishes, raw
Ріпа|Turnips, raw
Селера коренева|Celeriac, raw
Спаржа|Asparagus, raw
Топінамбур|Jerusalem-artichokes, raw
Фенхель|Fennel, bulb, raw
Хрін|Horseradish, prepared
Цвітна капуста|Cauliflower, raw
Цибуля|Onions, raw
Цибуля ріпчаста|Onions, raw
Цибуля порей|Leeks, (bulb and lower leaf-portion), raw
Часник|Garlic, raw
Базилік|Basil, fresh
Кріп|Dill weed, fresh
Кінза|Coriander (cilantro) leaves, raw
Петрушка|Parsley, fresh
Рукола|Arugula, raw
Мангольд|Chard, swiss, raw
Шніт-цибуля|Chives, raw
Селера стеблова|Celery, raw
Шпинат|Spinach, raw
Салат айсберг|Lettuce, iceberg (includes crisphead types), raw
Салат латук|Lettuce, green leaf, raw
Салат ромен|Lettuce, cos or romaine, raw
Гливи|Mushrooms, oyster, raw
Гриби печериці|Mushrooms, white, raw
Печериці|Mushrooms, white, raw
Печериці коричневі|Mushrooms, brown, italian, or crimini, raw
Енокі|Mushrooms, enoki, raw
Майтаке|Mushrooms, maitake, raw
Шиїтаке|Mushrooms, shiitake, raw
Сморчки|Mushrooms, morel, raw
Лисички|Mushrooms, chanterelle, raw
Арахіс|Peanuts, all types, raw
Мигдаль|Nuts, almonds
Мигдалеві пластівці|Nuts, almonds
Бразильський горіх|Nuts, brazilnuts, dried, unblanched
Волоський горіх|Nuts, walnuts, english
Кедрові горіхи|Nuts, pine nuts, dried
Кеш'ю|Nuts, cashew nuts, raw
Макадамія|Nuts, macadamia nuts, raw
Пекан|Nuts, pecans
Фундук|Nuts, hazelnuts or filberts
Фісташки|Nuts, pistachio nuts, raw
Насіння льону|Seeds, flaxseed
Насіння маку|Spices, poppy seed
Насіння чіа|Seeds, chia seeds, dried
Насіння конопель|Seeds, hemp seed, hulled
Насіння соняшнику|Seeds, sunflower seed kernels, dried
Насіння гарбуза|Seeds, pumpkin and squash seed kernels, dried
Бадьян|Spices, anise seed
Гвоздика|Spices, cloves, ground
Кардамон|Spices, cardamom
Зіра|Spices, cumin seed
Кмин|Spices, caraway seed
Карі|Spices, curry powder
Кориця|Spices, cinnamon, ground
Імбир свіжий|Ginger root, raw
Імбир мелений|Spices, ginger, ground
Коріандр зерна|Spices, coriander seed
Коріандр мелений|Spices, coriander seed
Куркума|Spices, turmeric, ground
Лавровий лист|Spices, bay leaf
Мускатний горіх|Spices, nutmeg, ground
Перець білий|Spices, pepper, white
Перець духмяний|Spices, allspice, ground
Перець кайєнський|Spices, pepper, red or cayenne
Перець чорний|Spices, pepper, black
Перець чорний горошком|Spices, pepper, black
Перець чорний мелений|Spices, pepper, black
Сушена петрушка|Spices, parsley, dried
Сушений базилік|Spices, basil, dried
Сушений орегано|Spices, oregano, dried
Сушений чебрець|Spices, thyme, dried
Сушений розмарин|Spices, rosemary, dried
Сіль|Salt, table
Шафран|Spices, saffron
Цибуля сушена|Spices, onion powder
Часник сушений|Spices, garlic powder
Мед|Honey
Меляса|Molasses
Фруктоза|Sweeteners, fructose, dry, powder
Цукор|Sugars, granulated
Цукор білий|Sugars, granulated
Цукор коричневий|Sugars, brown
Цукрова пудра|Sugars, powdered
Крохмаль кукурудзяний|Cornstarch
Кукурудзяний крохмаль|Cornstarch
Борошно нутове|Chickpea flour (besan)
Борошно житнє|Rye flour, medium
Борошно соєве|Soy flour, full-fat, raw
Какао-масло|Oil, cocoa butter
Желатин|Gelatins, dry powder, unsweetened
Какао-порошок|Cocoa, dry powder, unsweetened
Сода харчова|Leavening agents, baking soda
Томатна паста|Tomato products, canned, paste, without salt added
Масло топлене|Butter oil, anhydrous
Сир брі|Cheese, brie
Сир камамбер|Cheese, camembert
Сир гауда|Cheese, gouda
Сир чедер|Cheese, cheddar
Сир фета|Cheese, feta
Сир пармезан|Cheese, parmesan, hard
Інжир сушений|Figs, dried, uncooked
Чорнослив|Plums, dried (prunes), uncooked
Курага|Apricots, dried, sulfured, uncooked
Сушені яблука|Apples, dried, sulfured, uncooked
Сушені груші|Pears, dried, sulfured, uncooked
Краб|Crustaceans, crab, blue, raw
Короп|Fish, carp, raw
Щука|Fish, pike, northern, raw
Судак|Fish, pike, walleye, raw
Вугор|Fish, eel, mixed species, raw
Горбуша|Fish, salmon, pink, raw
Минтай|Fish, pollock, Alaska, raw
Скумбрія|Fish, mackerel, Atlantic, raw
Оселедець|Fish, herring, Atlantic, raw
Сом|Fish, catfish, channel, wild, raw
Тріска|Fish, cod, Atlantic, raw
Камбала|Fish, flatfish (flounder and sole species), raw
Кальмар|Mollusks, squid, mixed species, raw
Восьминіг|Mollusks, octopus, common, raw
Лобстер|Crustaceans, lobster, northern, raw
Борошно гречане|Buckwheat flour, whole-groat
Яйце|Egg, whole, raw, fresh
Яйце куряче|Egg, whole, raw, fresh
Яйце качине|Egg, duck, whole, fresh, raw
Яйце гусяче|Egg, goose, whole, fresh, raw
Яйце перепелине|Egg, quail, whole, fresh, raw
Яйце індиче|Egg, turkey, whole, fresh, raw
Яєчний білок|Egg, white, raw, fresh
Яєчний жовток|Egg, yolk, raw, fresh
Темпе|Tempeh
Олія соняшникова|Oil, sunflower, linoleic, (less than 60%)
Олія кокосова|Oil, coconut
Олія кунжутна|Oil, sesame, salad or cooking
Олія арахісова|Oil, peanut, salad or cooking
Олія лляна|Oil, flaxseed, cold pressed
Олія волоського горіха|Oil, walnut
Олія авокадо|Oil, avocado
Олія рисова|Oil, rice bran
Сочевиця|Lentils, raw
Нут|Chickpeas (garbanzo beans, bengal gram), mature seeds, raw
Маш|Mung beans, mature seeds, raw
Квасоля чорна|Beans, black, mature seeds, raw
Квасоля біла|Beans, white, mature seeds, raw
Квасоля червона|Beans, kidney, red, mature seeds, raw
Соєві боби|Soybeans, mature seeds, raw
Горох сухий|Peas, split, mature seeds, raw
Горох колотий|Peas, split, mature seeds, raw
Горох зелений|Peas, green, raw
Кіноа|Quinoa, uncooked
Пшоно|Millet, raw
Булгур|Bulgur, dry
Кускус|Couscous, dry
Амарант|Amaranth grain, uncooked
Спельта|Spelt, uncooked
Теф|Teff, uncooked
Перлова крупа|Barley, pearled, raw
Гречка|Buckwheat groats, roasted, dry
Дикий рис|Wild rice, raw'''
D=dict(x.split('|',1) for x in specs.splitlines())
# Reject entries whose name is underspecified for the dataset's fat, species or recipe.
for n in ['Хрін','Бадьян','Салат латук','Борошно житнє','Борошно соєве','Краб','Скумбрія','Оселедець','Сом','Тріска','Камбала','Олія соняшникова','Гречка','Часник сушений','Цибуля сушена','Кедрові горіхи','Насіння конопель','Курага'] : D.pop(n,None)
index={f['name'].lower():f for f in foods}
for i in range(3):
 original=json.loads((P/f'chunk-{i}.json').read_text(encoding='utf-8'));rows=[]
 for item in original:
  f=index.get(D.get(item['name'],'').lower())
  row=dict(ingredientId=item['id'],name=item['name'],fdcId=f['id'] if f else None,status='matched' if f else 'needs_review',note='Прямий запис USDA на 100 г їстівної частини; стан продукту в назві джерела. Вуглеводи включають клітковину.' if f else 'Не встановлено однозначного прямого відповідника. Потрібно уточнити різновид, стан, жирність або надати етикетку конкретного продукту.')
  if item['name']=="Шпажки дерев'яні":row.update(status='not_food',fdcId=None,note='Нехарчовий аксесуар для подачі; КБЖВ не застосовуються.')
  rows.append(row)
 (H/f'matches-{i}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
 print(i,sum(r['status']=='matched' for r in rows))
print('Missing exact dataset descriptions:',[n for n,q in D.items() if q.lower() not in index])
