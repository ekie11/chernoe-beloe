import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag, User, Shield, Search, X, Plus, Minus, Trash2,
  Package, Truck, CheckCircle, Circle, MapPin, Award, LogOut,
  Edit3, Save, ChevronRight, CreditCard, Star, Menu
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  МАГАЗИН ОДЕЖДЫ — MVP (чёрно-белый редакционный стиль)
 *  Каталог · 3 филиала · лояльность · ЛК клиента · оплата (симуляция)
 *  · трекинг доставки · админ-панель
 * ------------------------------------------------------------------ */

/* ---------- Постоянное хранилище (с фолбэком в память) ---------- */
const mem = {};
const store = {
  async get(key) {
    try {
      if (window.storage) { const r = await window.storage.get(key); return r ? r.value : null; }
    } catch (_) {}
    return mem[key] ?? null;
  },
  async set(key, value) {
    try { if (window.storage) { await window.storage.set(key, value); return; } } catch (_) {}
    mem[key] = value;
  },
};

/* ---------- Сид-данные ---------- */
const BRANCHES = [
  { id: "uu1", name: "Улан-Удэ Peoples Park", addr: "ул. Ленина, 30", short: "УУ-Ц" },
  { id: "uu2", name: "Улан-Удэ Galaxy", addr: "ул. Саянская, 11", short: "УУ-С" },
  { id: "irk", name: "Иркутск", addr: "ул. Карла Маркса, 21", short: "ИРК" },
];

const SEED_PRODUCTS = [
  { id: "p1", name: "Пальто оверсайз", cat: "Верхняя одежда", price: 18900, branches: ["uu1", "uu2"], stock: 7 },
  { id: "p2", name: "Рубашка поплин", cat: "Рубашки", price: 5400, branches: ["uu1", "uu2", "irk"], stock: 23 },
  { id: "p3", name: "Брюки прямые", cat: "Брюки", price: 7900, branches: ["uu1", "irk"], stock: 14 },
  { id: "p4", name: "Худи плотный хлопок", cat: "Трикотаж", price: 6200, branches: ["uu1", "uu2", "irk"], stock: 31 },
  { id: "p5", name: "Тренч классический", cat: "Верхняя одежда", price: 21500, branches: ["uu2"], stock: 4 },
  { id: "p6", name: "Футболка базовая", cat: "Трикотаж", price: 2200, branches: ["uu1", "uu2", "irk"], stock: 60 },
  { id: "p7", name: "Свитер шерсть", cat: "Трикотаж", price: 9800, branches: ["irk", "uu2"], stock: 11 },
  { id: "p8", name: "Джинсы прямые", cat: "Брюки", price: 8400, branches: ["uu1", "uu2", "irk"], stock: 19 },
  { id: "p9", name: "Юбка миди", cat: "Юбки", price: 6900, branches: ["uu1", "uu2"], stock: 9 },
  { id: "p10", name: "Жакет структурный", cat: "Верхняя одежда", price: 15400, branches: ["uu1"], stock: 6 },
];

/* ---------- Лояльность ---------- */
const TIERS = [
  { name: "Базовый", min: 0, rate: 0.05, perk: "5% бонусами с покупки" },
  { name: "Серебро", min: 30000, rate: 0.07, perk: "7% бонусами · ранний доступ" },
  { name: "Золото", min: 80000, rate: 0.10, perk: "10% бонусами · бесплатная доставка" },
  { name: "Платина", min: 200000, rate: 0.12, perk: "12% бонусами · персональный стилист" },
];
const tierFor = (spent) => [...TIERS].reverse().find((t) => spent >= t.min) || TIERS[0];

const STATUSES = ["Оформлен", "Собран", "Передан в доставку", "В пути", "Доставлен"];

const rub = (n) => n.toLocaleString("ru-RU") + " ₽";
const uid = () => Math.random().toString(36).slice(2, 9);

/* ================================================================== */
export default function App() {
  const [view, setView] = useState("catalog");
  const [branch, setBranch] = useState("uu1");
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);       // текущий клиент
  const [isAdmin, setIsAdmin] = useState(false);
  const [active, setActive] = useState(null);    // открытый товар
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Все");
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* загрузка */
  useEffect(() => {
    (async () => {
      const p = await store.get("shop:products");
      const u = await store.get("shop:users");
      const o = await store.get("shop:orders");
      if (p) try { setProducts(JSON.parse(p)); } catch (_) {}
      if (u) try { setUsers(JSON.parse(u)); } catch (_) {}
      if (o) try { setOrders(JSON.parse(o)); } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  /* сохранение */
  useEffect(() => { if (loaded) store.set("shop:products", JSON.stringify(products)); }, [products, loaded]);
  useEffect(() => { if (loaded) store.set("shop:users", JSON.stringify(users)); }, [users, loaded]);
  useEffect(() => { if (loaded) store.set("shop:orders", JSON.stringify(orders)); }, [orders, loaded]);

  const notify = useCallback((m) => { setToast(m); setTimeout(() => setToast(null), 2200); }, []);

  /* синхронизировать текущего пользователя с массивом users */
  useEffect(() => {
    if (user) { const fresh = users.find((x) => x.id === user.id); if (fresh) setUser(fresh); }
  }, [users]); // eslint-disable-line

  /* ---------- корзина ---------- */
  const addToCart = (p) => {
    setCart((c) => {
      const ex = c.find((i) => i.id === p.id);
      if (ex) return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
    notify("Добавлено в корзину");
  };
  const setQty = (id, d) => setCart((c) =>
    c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i)));
  const removeItem = (id) => setCart((c) => c.filter((i) => i.id !== id));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);

  /* ---------- авторизация (MVP, не для продакшена) ---------- */
  const register = (name, email, pass) => {
    if (users.find((u) => u.email === email)) { notify("Почта уже зарегистрирована"); return false; }
    const nu = { id: uid(), name, email, pass, points: 0, spent: 0, addr: "" };
    setUsers((s) => [...s, nu]); setUser(nu); notify("Аккаунт создан"); return true;
  };
  const login = (email, pass) => {
    if (email === "admin" && pass === "admin") { setIsAdmin(true); setView("admin"); notify("Вход администратора"); return true; }
    const u = users.find((x) => x.email === email && x.pass === pass);
    if (!u) { notify("Неверная почта или пароль"); return false; }
    setUser(u); notify("С возвращением, " + u.name); return true;
  };
  const logout = () => { setUser(null); setIsAdmin(false); setView("catalog"); };

  /* ---------- оформление заказа ---------- */
  const placeOrder = ({ usePoints, address }) => {
    const tier = user ? tierFor(user.spent) : TIERS[0];
    const maxRedeem = user ? Math.min(user.points, Math.floor(cartTotal * 0.5)) : 0;
    const redeemed = usePoints ? maxRedeem : 0;
    const payable = cartTotal - redeemed;
    const earned = user ? Math.round(payable * tier.rate) : 0;

    const order = {
      id: "ORD-" + uid().toUpperCase(),
      userId: user ? user.id : null,
      items: cart, total: cartTotal, redeemed, payable, earned,
      address, branch, status: 0,
      date: new Date().toISOString(),
    };
    setOrders((o) => [order, ...o]);

    if (user) {
      setUsers((s) => s.map((u) =>
        u.id === user.id
          ? { ...u, points: u.points - redeemed + earned, spent: u.spent + payable, addr: address || u.addr }
          : u));
    }
    setCart([]);
    setActive(order);
    setView("confirm");
  };

  /* ---------- админ: товары ---------- */
  const saveProduct = (p) => {
    setProducts((s) => {
      const ex = s.find((x) => x.id === p.id);
      return ex ? s.map((x) => (x.id === p.id ? p : x)) : [...s, { ...p, id: uid() }];
    });
    notify("Товар сохранён");
  };
  const deleteProduct = (id) => { setProducts((s) => s.filter((x) => x.id !== id)); notify("Товар удалён"); };
  const advanceOrder = (id) =>
    setOrders((s) => s.map((o) => (o.id === id ? { ...o, status: Math.min(STATUSES.length - 1, o.status + 1) } : o)));

  /* ---------- фильтрация каталога ---------- */
  const cats = ["Все", ...Array.from(new Set(products.map((p) => p.cat)))];
  const visible = products.filter((p) =>
    p.branches.includes(branch) &&
    (cat === "Все" || p.cat === cat) &&
    (query === "" || p.name.toLowerCase().includes(query.toLowerCase())));

  const go = (v) => { setView(v); setMenuOpen(false); window.scrollTo(0, 0); };

  /* ============================ UI ============================ */
  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased">
      {/* верхняя плашка филиалов */}
      <BranchBar branch={branch} setBranch={setBranch} />

      {/* шапка */}
      <header className="sticky top-0 z-40 bg-white border-b border-black">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => go("catalog")} className="flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tighter uppercase">Чёрное&Белое</span>
            <span className="hidden sm:inline text-xs tracking-[0.3em] uppercase text-gray-500">studio</span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-xs uppercase tracking-widest">
            <button onClick={() => go("catalog")} className="hover:underline underline-offset-4">Каталог</button>
            <button onClick={() => go("loyalty")} className="hover:underline underline-offset-4">Лояльность</button>
            <button onClick={() => go("track")} className="hover:underline underline-offset-4">Отслеживание</button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => go(user ? "account" : "auth")}
              className="p-2 hover:bg-black hover:text-white transition-colors" title="Аккаунт">
              <User size={18} />
            </button>
            {isAdmin && (
              <button onClick={() => go("admin")} className="p-2 hover:bg-black hover:text-white transition-colors" title="Админ">
                <Shield size={18} />
              </button>
            )}
            <button onClick={() => go("cart")} className="relative p-2 hover:bg-black hover:text-white transition-colors" title="Корзина">
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={() => setMenuOpen((o) => !o)} className="md:hidden p-2"><Menu size={18} /></button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-black px-4 py-3 flex flex-col gap-3 text-xs uppercase tracking-widest">
            <button onClick={() => go("catalog")} className="text-left">Каталог</button>
            <button onClick={() => go("loyalty")} className="text-left">Лояльность</button>
            <button onClick={() => go("track")} className="text-left">Отслеживание</button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === "catalog" && (
          <Catalog
            visible={visible} cats={cats} cat={cat} setCat={setCat}
            query={query} setQuery={setQuery} branch={branch}
            open={(p) => { setActive(p); go("product"); }} add={addToCart}
          />
        )}
        {view === "product" && active && (
          <Product p={active} branch={branch} add={addToCart} back={() => go("catalog")} />
        )}
        {view === "cart" && (
          <Cart cart={cart} total={cartTotal} setQty={setQty} remove={removeItem}
            checkout={() => go("checkout")} browse={() => go("catalog")} />
        )}
        {view === "checkout" && (
          <Checkout cart={cart} total={cartTotal} user={user} branch={branch}
            place={placeOrder} back={() => go("cart")} toAuth={() => go("auth")} />
        )}
        {view === "confirm" && active && (
          <Confirm order={active} toTrack={() => go("track")} toShop={() => go("catalog")} />
        )}
        {view === "auth" && (
          <Auth login={login} register={register} done={() => go(isAdmin ? "admin" : "account")} />
        )}
        {view === "account" && user && (
          <Account user={user} orders={orders.filter((o) => o.userId === user.id)}
            logout={logout} track={(o) => { setActive(o); go("track"); }}
            saveAddr={(addr) => setUsers((s) => s.map((u) => (u.id === user.id ? { ...u, addr } : u)))} />
        )}
        {view === "account" && !user && <NeedAuth toAuth={() => go("auth")} />}
        {view === "loyalty" && <Loyalty user={user} />}
        {view === "track" && (
          <Track orders={user ? orders.filter((o) => o.userId === user.id) : orders}
            preset={active && active.id && active.status !== undefined ? active : null}
            allOrders={orders} />
        )}
        {view === "admin" && isAdmin && (
          <Admin products={products} orders={orders} users={users}
            save={saveProduct} del={deleteProduct} advance={advanceOrder} />
        )}
        {view === "admin" && !isAdmin && (
          <div className="max-w-sm mx-auto text-center py-20">
            <Shield className="mx-auto mb-4" />
            <p className="mb-4 text-sm text-gray-600">Раздел для администратора. Войдите как admin.</p>
            <button onClick={() => go("auth")} className="border border-black px-6 py-2 text-xs uppercase tracking-widest hover:bg-black hover:text-white">Войти</button>
          </div>
        )}
      </main>

      <footer className="border-t border-black mt-16">
        <div className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8 text-xs">
          <div>
            <p className="text-xl font-black tracking-tighter uppercase mb-2">Чёрное&Белое</p>
            <p className="text-gray-500 leading-relaxed">Одежда в чёрном и белом.<br />Улан-Удэ и Иркутск.</p>
          </div>
          <div className="space-y-1 text-gray-600">
            {BRANCHES.map((b) => (
              <p key={b.id}><span className="font-semibold text-black">{b.name}</span> — {b.addr}</p>
            ))}
          </div>
          <div className="text-gray-500 space-y-1">
            <p className="uppercase tracking-widest text-black mb-2">Демо-доступ</p>
            <p>Админ: <span className="font-mono text-black">admin / admin</span></p>
            <p>Клиента — зарегистрируйте сами.</p>
          </div>
        </div>
      </footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs uppercase tracking-widest px-5 py-3 z-50 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ====================== КОМПОНЕНТЫ ====================== */

function BranchBar({ branch, setBranch }) {
  return (
    <div className="bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 h-9 flex items-center gap-1 text-[11px] uppercase tracking-widest overflow-x-auto">
        <MapPin size={12} className="shrink-0 mr-1 text-gray-400" />
        <span className="text-gray-400 mr-2 shrink-0">Филиал:</span>
        {BRANCHES.map((b) => (
          <button key={b.id} onClick={() => setBranch(b.id)}
            className={"px-3 py-1 shrink-0 transition-colors " + (branch === b.id ? "bg-white text-black" : "hover:text-gray-300")}>
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* визуальная «карточка-постер» вместо фото — на бренде */
function Poster({ name, cat, large }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className={"relative bg-gray-100 overflow-hidden " + (large ? "aspect-[4/5]" : "aspect-[3/4]")}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={"font-black tracking-tighter text-gray-300 " + (large ? "text-8xl" : "text-5xl")}>{initials}</span>
      </div>
      <div className="absolute top-0 left-0 right-0 h-px bg-black" />
      <div className="absolute bottom-2 left-2 text-[10px] uppercase tracking-widest text-gray-500">{cat}</div>
    </div>
  );
}

function Catalog({ visible, cats, cat, setCat, query, setQuery, branch, open, add }) {
  const bName = BRANCHES.find((b) => b.id === branch).name;
  return (
    <div>
      {/* hero */}
      <div className="border-y border-black py-10 mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Коллекция · {bName}</p>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tighter uppercase leading-none">
          Только чёрное<br />и белое.
        </h1>
      </div>

      {/* фильтры */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mb-8">
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={"px-3 py-1.5 text-xs uppercase tracking-widest border transition-colors " +
                (cat === c ? "bg-black text-white border-black" : "border-gray-300 hover:border-black")}>
              {c}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 focus:border-black outline-none w-full sm:w-56" />
        </div>
      </div>

      {/* сетка */}
      {visible.length === 0 ? (
        <p className="text-center text-gray-400 py-20 text-sm uppercase tracking-widest">Нет товаров в этом филиале</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
          {visible.map((p) => (
            <div key={p.id} className="group">
              <button onClick={() => open(p)} className="block w-full text-left">
                <Poster name={p.name} cat={p.cat} />
              </button>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-sm text-gray-500">{rub(p.price)}</p>
                </div>
                <button onClick={() => add(p)}
                  className="shrink-0 border border-black p-2 hover:bg-black hover:text-white transition-colors" title="В корзину">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Product({ p, branch, add, back }) {
  const avail = p.branches.map((id) => BRANCHES.find((b) => b.id === id).name);
  return (
    <div>
      <button onClick={back} className="text-xs uppercase tracking-widest text-gray-500 hover:text-black mb-6">← Назад в каталог</button>
      <div className="grid md:grid-cols-2 gap-10">
        <Poster name={p.name} cat={p.cat} large />
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">{p.cat}</p>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-4">{p.name}</h1>
          <p className="text-2xl mb-6">{rub(p.price)}</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-6 border-t border-b border-gray-200 py-5">
            Минималистичная вещь капсульного гардероба. Плотные натуральные ткани,
            чистый крой, нейтральная палитра. Сочетается со всем в коллекции.
          </p>
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">В наличии</div>
          <p className="text-sm mb-1">Остаток: {p.stock} шт.</p>
          <p className="text-sm mb-6">Филиалы: {avail.join(", ")}</p>
          <button onClick={() => add(p)}
            className="w-full bg-black text-white py-4 text-xs uppercase tracking-[0.3em] hover:bg-gray-800 transition-colors">
            Добавить в корзину
          </button>
        </div>
      </div>
    </div>
  );
}

function Cart({ cart, total, setQty, remove, checkout, browse }) {
  if (cart.length === 0)
    return (
      <div className="text-center py-24">
        <ShoppingBag className="mx-auto mb-4 text-gray-300" size={40} />
        <p className="text-sm uppercase tracking-widest text-gray-500 mb-6">Корзина пуста</p>
        <button onClick={browse} className="border border-black px-6 py-2 text-xs uppercase tracking-widest hover:bg-black hover:text-white">В каталог</button>
      </div>
    );
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black tracking-tighter uppercase mb-8">Корзина</h1>
      <div className="divide-y divide-gray-200 border-y border-gray-200">
        {cart.map((i) => (
          <div key={i.id} className="flex items-center gap-4 py-4">
            <div className="w-14 h-16 bg-gray-100 flex items-center justify-center shrink-0">
              <span className="font-black text-gray-300">{i.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{i.name}</p>
              <p className="text-sm text-gray-500">{rub(i.price)}</p>
            </div>
            <div className="flex items-center border border-gray-300">
              <button onClick={() => setQty(i.id, -1)} className="p-2 hover:bg-gray-100"><Minus size={13} /></button>
              <span className="w-8 text-center text-sm">{i.qty}</span>
              <button onClick={() => setQty(i.id, 1)} className="p-2 hover:bg-gray-100"><Plus size={13} /></button>
            </div>
            <p className="w-24 text-right text-sm font-medium">{rub(i.price * i.qty)}</p>
            <button onClick={() => remove(i.id)} className="text-gray-400 hover:text-black"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-6 mb-8">
        <span className="text-xs uppercase tracking-widest text-gray-500">Итого</span>
        <span className="text-2xl font-black">{rub(total)}</span>
      </div>
      <button onClick={checkout} className="w-full bg-black text-white py-4 text-xs uppercase tracking-[0.3em] hover:bg-gray-800">
        Оформить заказ
      </button>
    </div>
  );
}

function Checkout({ cart, total, user, branch, place, back, toAuth }) {
  const [usePoints, setUsePoints] = useState(false);
  const [address, setAddress] = useState(user?.addr || "");
  const [method, setMethod] = useState("card");
  const tier = user ? tierFor(user.spent) : TIERS[0];
  const maxRedeem = user ? Math.min(user.points, Math.floor(total * 0.5)) : 0;
  const redeemed = usePoints ? maxRedeem : 0;
  const payable = total - redeemed;
  const earn = user ? Math.round(payable * tier.rate) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={back} className="text-xs uppercase tracking-widest text-gray-500 hover:text-black mb-6">← Корзина</button>
      <h1 className="text-3xl font-black tracking-tighter uppercase mb-8">Оформление</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          {!user && (
            <div className="border border-gray-300 p-4 mb-6 text-sm">
              <p className="text-gray-600 mb-2">Войдите, чтобы копить и тратить бонусы.</p>
              <button onClick={toAuth} className="text-xs uppercase tracking-widest underline underline-offset-4">Войти / Регистрация</button>
            </div>
          )}

          <Label>Адрес доставки</Label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
            placeholder="Город, улица, дом, квартира, индекс"
            className="w-full border border-gray-300 focus:border-black outline-none p-3 text-sm mb-6" />

          <Label>Способ оплаты</Label>
          <div className="space-y-2 mb-6">
            {[["card", "Банковская карта"], ["sbp", "СБП по QR"], ["cash", "При получении"]].map(([k, t]) => (
              <button key={k} onClick={() => setMethod(k)}
                className={"w-full flex items-center gap-3 border p-3 text-sm transition-colors " +
                  (method === k ? "border-black bg-black text-white" : "border-gray-300 hover:border-black")}>
                {method === k ? <CheckCircle size={16} /> : <Circle size={16} />}
                <span>{t}</span>
                {k === "card" && <CreditCard size={15} className="ml-auto" />}
              </button>
            ))}
          </div>

          {user && maxRedeem > 0 && (
            <button onClick={() => setUsePoints((v) => !v)}
              className={"w-full flex items-center gap-3 border p-3 text-sm transition-colors " +
                (usePoints ? "border-black bg-black text-white" : "border-gray-300 hover:border-black")}>
              {usePoints ? <CheckCircle size={16} /> : <Circle size={16} />}
              <span>Списать {maxRedeem} бонусов (−{rub(maxRedeem)})</span>
            </button>
          )}
        </div>

        <div className="border border-black p-5 h-fit">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Ваш заказ</p>
          {cart.map((i) => (
            <div key={i.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{i.name} × {i.qty}</span>
              <span>{rub(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 mt-3 pt-3 space-y-1 text-sm">
            <Row k="Сумма" v={rub(total)} />
            {redeemed > 0 && <Row k="Бонусы" v={"−" + rub(redeemed)} />}
            <Row k="Доставка" v={tier.name === "Золото" || tier.name === "Платина" ? "Бесплатно" : rub(0)} />
            <div className="flex justify-between pt-2 border-t border-black mt-2">
              <span className="font-black uppercase tracking-widest text-xs self-center">К оплате</span>
              <span className="text-2xl font-black">{rub(payable)}</span>
            </div>
            {user && <p className="text-xs text-gray-500 pt-1">+ {earn} бонусов на счёт ({Math.round(tier.rate * 100)}%)</p>}
          </div>
          <button onClick={() => place({ usePoints, address })}
            className="w-full bg-black text-white py-4 mt-5 text-xs uppercase tracking-[0.3em] hover:bg-gray-800">
            Оплатить
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-3 leading-snug">
            Демо-оплата. В продакшене подключается платёжный шлюз (ЮKassa / CloudPayments / Stripe) на стороне сервера.
          </p>
        </div>
      </div>
    </div>
  );
}

function Confirm({ order, toTrack, toShop }) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <CheckCircle size={48} className="mx-auto mb-6" />
      <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">Заказ оформлен</h1>
      <p className="text-sm text-gray-500 mb-8 font-mono">{order.id}</p>
      <div className="border-y border-gray-200 py-5 text-sm text-left max-w-sm mx-auto space-y-1 mb-8">
        <Row k="Оплачено" v={rub(order.payable)} />
        {order.redeemed > 0 && <Row k="Списано бонусов" v={String(order.redeemed)} />}
        {order.earned > 0 && <Row k="Начислено бонусов" v={"+" + order.earned} />}
        <Row k="Филиал" v={BRANCHES.find((b) => b.id === order.branch)?.name || "—"} />
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={toTrack} className="bg-black text-white px-6 py-3 text-xs uppercase tracking-widest hover:bg-gray-800">Отследить</button>
        <button onClick={toShop} className="border border-black px-6 py-3 text-xs uppercase tracking-widest hover:bg-black hover:text-white">В каталог</button>
      </div>
    </div>
  );
}

function Auth({ login, register, done }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", pass: "" });
  const submit = () => {
    const ok = mode === "login" ? login(f.email, f.pass) : register(f.name, f.email, f.pass);
    if (ok) done();
  };
  return (
    <div className="max-w-sm mx-auto py-8">
      <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">{mode === "login" ? "Вход" : "Регистрация"}</h1>
      <p className="text-xs text-gray-500 mb-8">Личный кабинет, бонусы и история заказов.</p>
      {mode === "register" && (
        <>
          <Label>Имя</Label>
          <Inp value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="Как к вам обращаться" />
        </>
      )}
      <Label>Почта / логин</Label>
      <Inp value={f.email} onChange={(v) => setF({ ...f, email: v })} placeholder="you@mail.ru" />
      <Label>Пароль</Label>
      <Inp type="password" value={f.pass} onChange={(v) => setF({ ...f, pass: v })} placeholder="••••••••" />
      <button onClick={submit} className="w-full bg-black text-white py-4 mt-2 text-xs uppercase tracking-[0.3em] hover:bg-gray-800">
        {mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
      <button onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="w-full text-center text-xs uppercase tracking-widest text-gray-500 hover:text-black mt-4">
        {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
      <p className="text-[10px] text-gray-400 text-center mt-6 leading-snug">
        Демо-авторизация хранится локально в браузере. В продакшене — настоящий бэкенд с хешированием паролей.
      </p>
    </div>
  );
}

function NeedAuth({ toAuth }) {
  return (
    <div className="text-center py-24">
      <User className="mx-auto mb-4 text-gray-300" size={40} />
      <p className="text-sm uppercase tracking-widest text-gray-500 mb-6">Войдите в личный кабинет</p>
      <button onClick={toAuth} className="border border-black px-6 py-2 text-xs uppercase tracking-widest hover:bg-black hover:text-white">Войти</button>
    </div>
  );
}

function Account({ user, orders, logout, track, saveAddr }) {
  const tier = tierFor(user.spent);
  const idx = TIERS.indexOf(tier);
  const next = TIERS[idx + 1];
  const progress = next ? Math.min(100, Math.round((user.spent / next.min) * 100)) : 100;
  const [addr, setAddr] = useState(user.addr || "");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">{user.name}</h1>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-500 hover:text-black">
          <LogOut size={14} /> Выйти
        </button>
      </div>

      {/* лояльность */}
      <div className="border border-black p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award size={18} />
            <span className="font-black uppercase tracking-widest text-sm">{tier.name}</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black leading-none">{user.points}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">бонусов</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 mb-4">{tier.perk}</p>
        {next ? (
          <>
            <div className="h-1 bg-gray-200">
              <div className="h-full bg-black" style={{ width: progress + "%" }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              До уровня «{next.name}» — {rub(Math.max(0, next.min - user.spent))}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-gray-500">Максимальный уровень достигнут</p>
        )}
      </div>

      {/* адрес */}
      <div className="mb-8">
        <Label>Адрес доставки по умолчанию</Label>
        <div className="flex gap-2">
          <input value={addr} onChange={(e) => setAddr(e.target.value)}
            className="flex-1 border border-gray-300 focus:border-black outline-none p-3 text-sm" placeholder="Город, улица, дом" />
          <button onClick={() => saveAddr(addr)} className="border border-black px-4 hover:bg-black hover:text-white"><Save size={15} /></button>
        </div>
      </div>

      {/* заказы */}
      <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-3">История заказов</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-400 py-6">Заказов пока нет.</p>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {orders.map((o) => (
            <button key={o.id} onClick={() => track(o)} className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-50 px-2">
              <div>
                <p className="text-sm font-mono">{o.id}</p>
                <p className="text-xs text-gray-500">{new Date(o.date).toLocaleDateString("ru-RU")} · {STATUSES[o.status]}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{rub(o.payable)}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Loyalty({ user }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="border-y border-black py-8 mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">Программа</p>
        <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Лояльность</h1>
      </div>
      <p className="text-sm text-gray-600 mb-8 leading-relaxed max-w-xl">
        Бонусы начисляются с каждой оплаченной покупки и растут вместе с уровнем.
        1 бонус = 1 ₽. Бонусами можно оплатить до 50% заказа.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {TIERS.map((t, i) => {
          const cur = user && tierFor(user.spent).name === t.name;
          return (
            <div key={t.name} className={"border p-5 " + (cur ? "border-black bg-black text-white" : "border-gray-300")}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                  <Star size={14} fill={cur ? "white" : "none"} /> {t.name}
                </span>
                <span className="text-xs opacity-70">{Math.round(t.rate * 100)}%</span>
              </div>
              <p className={"text-xs mb-3 " + (cur ? "text-gray-300" : "text-gray-600")}>{t.perk}</p>
              <p className={"text-[11px] uppercase tracking-widest " + (cur ? "text-gray-400" : "text-gray-400")}>
                {t.min === 0 ? "от старта" : "от " + rub(t.min) + " покупок"}
              </p>
              {cur && <p className="text-[10px] uppercase tracking-widest text-white mt-2">— ваш уровень</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Track({ orders, preset, allOrders }) {
  const [q, setQ] = useState(preset?.id || "");
  const found = q ? allOrders.find((o) => o.id.toLowerCase() === q.trim().toLowerCase()) : null;
  const list = orders;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="border-y border-black py-8 mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">Доставка</p>
        <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Отслеживание</h1>
      </div>

      <Label>Номер заказа</Label>
      <Inp value={q} onChange={setQ} placeholder="ORD-XXXXXXX" />

      {q && !found && <p className="text-sm text-gray-400 mt-4">Заказ не найден.</p>}
      {found && <TrackTimeline order={found} />}

      {!q && list.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Ваши заказы</h2>
          {list.map((o) => <TrackTimeline key={o.id} order={o} compact />)}
        </div>
      )}
      {!q && list.length === 0 && (
        <p className="text-sm text-gray-400 mt-6">Введите номер заказа, чтобы увидеть статус доставки.</p>
      )}
    </div>
  );
}

function TrackTimeline({ order, compact }) {
  const branch = BRANCHES.find((b) => b.id === order.branch);
  return (
    <div className="border border-gray-300 p-5 mt-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-mono">{order.id}</p>
          <p className="text-xs text-gray-500">Из филиала: {branch?.name} · {rub(order.payable)}</p>
        </div>
        <Truck size={18} className="text-gray-400" />
      </div>
      <div className="space-y-0">
        {STATUSES.map((s, i) => {
          const done = i <= order.status;
          const isLast = i === STATUSES.length - 1;
          return (
            <div key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={"w-3 h-3 rounded-full border-2 " + (done ? "bg-black border-black" : "bg-white border-gray-300")} />
                {!isLast && <div className={"w-0.5 h-7 " + (i < order.status ? "bg-black" : "bg-gray-200")} />}
              </div>
              <p className={"text-sm -mt-0.5 pb-4 " + (done ? "text-black font-medium" : "text-gray-400")}>{s}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- АДМИН ---------------- */
function Admin({ products, orders, users, save, del, advance }) {
  const [tab, setTab] = useState("products");
  const tabs = [["products", "Товары"], ["orders", "Заказы"], ["clients", "Клиенты"]];
  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <Shield size={20} />
        <h1 className="text-3xl font-black tracking-tighter uppercase">Админ-панель</h1>
      </div>
      <div className="flex gap-1 border-b border-black mb-8">
        {tabs.map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={"px-5 py-2 text-xs uppercase tracking-widest -mb-px border-b-2 " +
              (tab === k ? "border-black font-bold" : "border-transparent text-gray-400 hover:text-black")}>
            {t}
          </button>
        ))}
      </div>
      {tab === "products" && <AdminProducts products={products} save={save} del={del} />}
      {tab === "orders" && <AdminOrders orders={orders} advance={advance} />}
      {tab === "clients" && <AdminClients users={users} orders={orders} />}
    </div>
  );
}

function AdminProducts({ products, save, del }) {
  const blank = { id: "", name: "", cat: "", price: 0, stock: 0, branches: [] };
  const [edit, setEdit] = useState(null);
  const toggleBranch = (b) =>
    setEdit((e) => ({ ...e, branches: e.branches.includes(b) ? e.branches.filter((x) => x !== b) : [...e.branches, b] }));

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <p className="text-xs uppercase tracking-widest text-gray-500">{products.length} позиций</p>
        <button onClick={() => setEdit(blank)} className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-gray-800">
          <Plus size={14} /> Добавить товар
        </button>
      </div>

      {edit && (
        <div className="border border-black p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Название</Label><Inp value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} /></div>
            <div><Label>Категория</Label><Inp value={edit.cat} onChange={(v) => setEdit({ ...edit, cat: v })} /></div>
            <div><Label>Цена, ₽</Label><Inp type="number" value={edit.price} onChange={(v) => setEdit({ ...edit, price: Number(v) })} /></div>
            <div><Label>Остаток, шт.</Label><Inp type="number" value={edit.stock} onChange={(v) => setEdit({ ...edit, stock: Number(v) })} /></div>
          </div>
          <Label>Доступно в филиалах</Label>
          <div className="flex gap-2 mb-4">
            {BRANCHES.map((b) => (
              <button key={b.id} onClick={() => toggleBranch(b.id)}
                className={"px-3 py-1.5 text-xs uppercase tracking-widest border " +
                  (edit.branches.includes(b.id) ? "bg-black text-white border-black" : "border-gray-300 hover:border-black")}>
                {b.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { save(edit); setEdit(null); }}
              className="bg-black text-white px-5 py-2 text-xs uppercase tracking-widest hover:bg-gray-800">Сохранить</button>
            <button onClick={() => setEdit(null)} className="border border-gray-300 px-5 py-2 text-xs uppercase tracking-widest hover:border-black">Отмена</button>
          </div>
        </div>
      )}

      <div className="border-y border-gray-200 divide-y divide-gray-200">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-4 py-3">
            <div className="w-10 h-12 bg-gray-100 flex items-center justify-center shrink-0">
              <span className="font-black text-gray-300 text-sm">{p.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-gray-500">{p.cat} · {p.branches.map((b) => BRANCHES.find((x) => x.id === b)?.short).join(" ")}</p>
            </div>
            <span className="text-sm w-24 text-right">{rub(p.price)}</span>
            <span className="text-xs text-gray-500 w-16 text-right">{p.stock} шт.</span>
            <button onClick={() => setEdit({ ...p })} className="p-2 hover:bg-gray-100"><Edit3 size={15} /></button>
            <button onClick={() => del(p.id)} className="p-2 text-gray-400 hover:text-black"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminOrders({ orders, advance }) {
  if (orders.length === 0) return <p className="text-sm text-gray-400 py-6">Заказов пока нет.</p>;
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-mono">{o.id}</p>
              <p className="text-xs text-gray-500">
                {new Date(o.date).toLocaleString("ru-RU")} · {BRANCHES.find((b) => b.id === o.branch)?.name} · {rub(o.payable)}
              </p>
            </div>
            <span className="text-xs uppercase tracking-widest border border-black px-2 py-1">{STATUSES[o.status]}</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            {o.items.map((i) => i.name + " ×" + i.qty).join(", ")}
            {o.address ? " — " + o.address : ""}
          </p>
          {o.status < STATUSES.length - 1 ? (
            <button onClick={() => advance(o.id)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-gray-800">
              <Package size={13} /> Перевести в «{STATUSES[o.status + 1]}»
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-500"><CheckCircle size={14} /> Доставлен</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminClients({ users, orders }) {
  if (users.length === 0) return <p className="text-sm text-gray-400 py-6">Клиентов пока нет. Зарегистрируйте аккаунт на витрине.</p>;
  return (
    <div className="border-y border-gray-200 divide-y divide-gray-200">
      {users.map((u) => {
        const cnt = orders.filter((o) => o.userId === u.id).length;
        const tier = tierFor(u.spent);
        return (
          <div key={u.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-gray-500">{u.email} · {cnt} заказ(ов)</p>
            </div>
            <div className="text-right">
              <p className="text-sm">{u.points} бонусов</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">{tier.name} · {rub(u.spent)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- мелкие helpers ---------------- */
function Label({ children }) {
  return <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 mt-2">{children}</p>;
}
function Inp({ value, onChange, type = "text", placeholder }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-300 focus:border-black outline-none p-3 text-sm mb-3" />
  );
}
function Row({ k, v }) {
  return <div className="flex justify-between"><span className="text-gray-500">{k}</span><span>{v}</span></div>;
}