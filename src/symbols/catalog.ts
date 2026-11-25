export type Category =
  | 'maneuver'
  | 'fires'
  | 'airdef'
  | 'support'
  | 'command'
  | 'aviation'
  | 'weapons'
  | 'objects';

export const CATEGORY_NAMES: Record<Category, string> = {
  maneuver: 'Общевойсковые',
  fires: 'Артиллерия',
  airdef: 'ПВО',
  support: 'Обеспечение',
  command: 'Управление',
  aviation: 'Авиация и БПЛА',
  weapons: 'Огневые средства',
  objects: 'Объекты',
};

export interface SymbolDef {
  id: string;
  name: string;
  category: Category;
  /** 6-char MIL-STD-2525C function id (positions 5-10), null when the NATO set has no equivalent. */
  nato: string | null;
  /** Use 2525C equipment/unit code dimension: units use echelon, equipment does not. */
  equipment?: boolean;
  keywords?: string;
}

export const SYMBOLS: SymbolDef[] = [
  { id: 'msr', name: 'Мотострелки', category: 'maneuver', nato: 'UCIZ--', keywords: 'пехота бмп мотострелковое' },
  { id: 'inf', name: 'Пехота', category: 'maneuver', nato: 'UCI---', keywords: 'стрелки' },
  { id: 'tank', name: 'Танки', category: 'maneuver', nato: 'UCA---', keywords: 'танковое бронетехника' },
  { id: 'bmp', name: 'БМП', category: 'maneuver', nato: 'UCIZ--', equipment: false, keywords: 'боевая машина пехоты' },
  { id: 'btr', name: 'БТР', category: 'maneuver', nato: 'UCIM--', keywords: 'бронетранспортёр колёсный моторизованная' },
  { id: 'vdv', name: 'ВДВ', category: 'maneuver', nato: 'UCIA--', keywords: 'десант воздушно-десантные' },
  { id: 'recon', name: 'Разведка', category: 'maneuver', nato: 'UCR---', keywords: 'разведывательное дозор' },
  { id: 'sniper', name: 'Снайперы', category: 'maneuver', nato: 'UCIS--', keywords: 'снайпер' },

  { id: 'gun', name: 'Артиллерия (букс.)', category: 'fires', nato: 'UCFH--', keywords: 'гаубица орудие пушка буксируемая' },
  { id: 'sau', name: 'САУ', category: 'fires', nato: 'UCFHE-', keywords: 'самоходная артиллерия гаубица' },
  { id: 'mortar', name: 'Миномёты', category: 'fires', nato: 'UCFM--', keywords: 'миномет' },
  { id: 'mlrs', name: 'РСЗО', category: 'fires', nato: 'UCFRM-', keywords: 'реактивная град ураган' },
  { id: 'atgm', name: 'ПТУР', category: 'fires', nato: 'UCAA--', keywords: 'противотанковые ракеты птрк' },

  { id: 'sam', name: 'ЗРК', category: 'airdef', nato: 'UCDM--', keywords: 'зенитный ракетный комплекс пво' },
  { id: 'aaa', name: 'Зенитная артиллерия', category: 'airdef', nato: 'UCD---', keywords: 'зу зсу шилка тунгуска' },
  { id: 'manpads', name: 'ПЗРК', category: 'airdef', nato: 'UCDML-', keywords: 'игла верба переносной' },

  { id: 'engineer', name: 'Инженерные', category: 'support', nato: 'UCE---', keywords: 'сапёры инженерное' },
  { id: 'signal', name: 'Связь', category: 'support', nato: 'UUS---', keywords: 'связисты' },
  { id: 'ew', name: 'РЭБ', category: 'support', nato: 'UUMSE-', keywords: 'радиоэлектронная борьба' },
  { id: 'medical', name: 'Медпункт', category: 'support', nato: 'USM---', keywords: 'медицинский госпиталь' },
  { id: 'supply', name: 'Склад / снабжение', category: 'support', nato: 'USS---', keywords: 'тыл материальное обеспечение' },
  { id: 'fuel', name: 'ГСМ', category: 'support', nato: 'USS3--', keywords: 'топливо горючее' },
  { id: 'repair', name: 'Ремонт', category: 'support', nato: 'USX---', keywords: 'ремонтная эвакуация техобслуживание' },
  { id: 'transport', name: 'Автотранспорт', category: 'support', nato: 'UST---', keywords: 'грузовик автомобильная' },
  { id: 'mp', name: 'Военная полиция / блокпост', category: 'support', nato: 'UULM--', keywords: 'комендантская кпп' },

  { id: 'kp', name: 'Командный пункт', category: 'command', nato: 'U-----', keywords: 'кп штаб управление' },
  { id: 'np', name: 'Наблюдательный пункт', category: 'command', nato: 'UCRVA-', keywords: 'нп наблюдение' },

  { id: 'heli', name: 'Вертолёты', category: 'aviation', nato: 'UCVR--', keywords: 'армейская авиация ка ми' },
  { id: 'plane', name: 'Самолёты', category: 'aviation', nato: 'UCVF--', keywords: 'авиация штурмовик' },
  { id: 'uav', name: 'БПЛА', category: 'aviation', nato: 'UCVU--', keywords: 'дрон беспилотник' },

  { id: 'mg', name: 'Пулемёт', category: 'weapons', nato: 'EWRL--', equipment: true, keywords: 'пулемет пк' },
  { id: 'hmg', name: 'Крупнокал. пулемёт', category: 'weapons', nato: 'EWRH--', equipment: true, keywords: 'нсв корд дшк' },
  { id: 'agl', name: 'АГС', category: 'weapons', nato: 'EWZL--', equipment: true, keywords: 'гранатомёт автоматический' },
  { id: 'atgl', name: 'ПТРК / РПГ', category: 'weapons', nato: 'EWMAS-', equipment: true, keywords: 'противотанковый гранатомет рпг' },

  { id: 'strong', name: 'Опорный пункт', category: 'objects', nato: null, keywords: 'оборона позиция' },
  { id: 'mine', name: 'Мина', category: 'objects', nato: null, keywords: 'минирование' },
  { id: 'strike', name: 'Удар / разрыв', category: 'objects', nato: null, keywords: 'поражение взрыв' },
  { id: 'target', name: 'Цель', category: 'objects', nato: null, keywords: 'ориентир' },
  { id: 'bridge', name: 'Мост', category: 'objects', nato: null, keywords: 'переправа' },
];

export const SYMBOL_BY_ID: Record<string, SymbolDef> = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
