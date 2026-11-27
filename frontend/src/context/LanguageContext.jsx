import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  roman_urdu: {
    brand_tagline: "Dukaan Ka Digital Dimagh — Retail Intelligence",
    store_title: "Al-Madina General Store",
    store_location: "Sector G-9, Islamabad",
    demo_badge: "Demo Data",
    
    // Nav tabs
    tab_overview: "Dukaan Ka Jaiza",
    tab_mart_walk: "3D Mart Walkthrough",
    tab_reorder: "Hero Reorder Plan (PKR 50k)",
    tab_products: "Maal o Asbaab (Catalog)",
    tab_khata: "Khata o Wasooli (Safe Mark)",
    tab_cashflow: "Cash Outlook (7 Din)",
    tab_csv: "CSV Invoices Upload",
    
    // Top banner / action bar
    today_actions_title: "Aaj Ke 3 Zaroori Faislay (Urgent Actions)",
    action_stockout_btn: "Fauran Reorder Karein",
    action_combo_btn: "Bachat Combo Banayein",
    action_wasooli_btn: "Wasooli Reminder Bheinjein",
    action_price_btn: "Qeemat Update Karein",

    // Mart Walkthrough Hotspots
    mart_title: "Al-Madina Store — Interactive 2.5D Mart Walkthrough",
    mart_subtitle: "Dukaan ke aisles par live alerts dekhein aur fauran action lein.",
    hotspot_oil: "Cooking Oil Shelf",
    hotspot_oil_desc: "Dalda Oil khatam honay wala hai (2.9 din baqi)",
    hotspot_clean: "Detergent & Cleaning Shelf",
    hotspot_clean_desc: "Sparkle Cleaner dead stock (87 din se farokht band)",
    hotspot_spice: "Spices & Chai Rack",
    hotspot_spice_desc: "National Masala & Mezan Tea par supplier ne qeemat barhai (+12%)",
    hotspot_dairy: "Dairy & Chiller",
    hotspot_dairy_desc: "Olpers Milk & Desi Anday tez bikne wala maal",
    hotspot_khata: "Khata Cash Counter",
    hotspot_khata_desc: "Tariq Grocers ka PKR 38,400 udhaar 45 din se overdue",

    // Hero Reorder
    hero_title: "Hero Flow: 'Mere Paas PKR 50,000 Hain — Kya Khareedun Aur Kyun?'",
    hero_subtitle: "Knapsack Budget Optimizer aap ke budget ke mutabiq wholesale packs (cartons/bori/crates) allocate karta hai.",
    budget_label: "Aap Ka Aaj Ka Budget (PKR):",
    allocated_spend: "Kul Allocate Hua Kharcha:",
    unspent_cash: "Baqi Bachi Hui Raqam:",
    projected_revenue: "Mutawaqqa Farokht (14 Din):",
    projected_profit: "Mutawaqqa Munafa:",
    btn_generate_po: "WhatsApp Order Bheinjein",
    
    // Product Catalog
    catalog_title: "Dukaan Ka Mukammal Stock (120 SKUs)",
    search_placeholder: "Product ka naam ya SKU talash karein (e.g. Dalda, Surf, Rooh Afza)...",
    filter_all: "Tamam Items",
    filter_critical: "Khatarnak Stockout",
    filter_squeezed: "Margin Squeeze",
    filter_dead: "Phasa Hua Maal (Dead Stock)",
    col_product: "Saman Ka Naam",
    col_category: "Category",
    col_stock: "Mojooda Stock",
    col_cover: "Stock Cover",
    col_cost: "Wholesale Khareed",
    col_sale: "Retail Farokht",
    col_margin: "Munafa %",
    col_actions: "Action",

    // Khata
    khata_title: "Khata Wasooli & Safe Mark Credit Intelligence",
    total_receivable: "Kul Market Udhaar",
    overdue_30d: "30+ Din Purana Udhaar (Khatarnak)",
    safemark_score: "Safe Mark Credit Score",
    send_whatsapp_btn: "WhatsApp Wasooli Reminder",
    record_payment_btn: "Raqam Wasool Hui",
    
    // Copilot
    copilot_title: "HisaabAI Dukandar Copilot",
    copilot_placeholder: "Dukaan ke mutaliq koi bhi sawal puchein (Roman Urdu / English)...",
    copilot_ask_reorder: "PKR 50,000 budget me kya khareedun?",
    copilot_ask_deadstock: "Kaunsa maal phasa hua hai?",
    copilot_ask_margin: "Kahan munafa kam ho raha hai?",
    copilot_ask_wasooli: "Sabse ziyada udhaar kiska hai?",
  },
  
  english: {
    brand_tagline: "AI Copilot for Pakistani General Stores",
    store_title: "Al-Madina General Store",
    store_location: "Sector G-9, Islamabad",
    demo_badge: "Demo Data",

    // Nav tabs
    tab_overview: "Dashboard Overview",
    tab_mart_walk: "3D Mart Walkthrough",
    tab_reorder: "Hero Reorder Plan (PKR 50k)",
    tab_products: "Product Catalog (120 SKUs)",
    tab_khata: "Khata & Safe Mark Credit",
    tab_cashflow: "7-Day Cash Outlook",
    tab_csv: "CSV Invoices Ingestion",

    // Top banner
    today_actions_title: "Today's 3 Urgent Actions",
    action_stockout_btn: "Reorder Now",
    action_combo_btn: "Create Combo Deal",
    action_wasooli_btn: "Send Wasooli Reminder",
    action_price_btn: "Update Price",

    // Mart Walkthrough Hotspots
    mart_title: "Al-Madina Store — Interactive 2.5D Mart Walkthrough",
    mart_subtitle: "Explore live shelf alerts across aisles and trigger actions instantly.",
    hotspot_oil: "Cooking Oil Shelf",
    hotspot_oil_desc: "Dalda Oil stockout imminent (2.9 days cover left)",
    hotspot_clean: "Detergent & Cleaning Shelf",
    hotspot_clean_desc: "Sparkle Cleaner dead stock (87 days no sales)",
    hotspot_spice: "Spices & Tea Rack",
    hotspot_spice_desc: "National Masala & Mezan Tea wholesale price hike (+12%)",
    hotspot_dairy: "Dairy & Chiller",
    hotspot_dairy_desc: "Olpers Milk & Farm Fresh Eggs high velocity demand",
    hotspot_khata: "Khata Ledger Counter",
    hotspot_khata_desc: "Tariq Grocers PKR 38,400 overdue 45 days",

    // Hero Reorder
    hero_title: "Hero Flow: 'I have PKR 50,000. What should I buy today and why?'",
    hero_subtitle: "Knapsack Budget Optimizer allocates spend strictly within budget rounded to whole wholesale packs.",
    budget_label: "Enter Reorder Budget (PKR):",
    allocated_spend: "Total Allocated Spend:",
    unspent_cash: "Remaining Cash Reserve:",
    projected_revenue: "Projected 14-Day Sales:",
    projected_profit: "Projected Gross Margin:",
    btn_generate_po: "Send WhatsApp Purchase Order",

    // Product Catalog
    catalog_title: "Complete Product Catalog (120 SKUs)",
    search_placeholder: "Search product name or SKU (e.g. Dalda, Surf, Rooh Afza)...",
    filter_all: "All Items",
    filter_critical: "Stockout Risk",
    filter_squeezed: "Margin Squeeze",
    filter_dead: "Dead Stock",
    col_product: "Product Name",
    col_category: "Category",
    col_stock: "Stock on Hand",
    col_cover: "Stock Cover",
    col_cost: "Wholesale Cost",
    col_sale: "Retail Price",
    col_margin: "Margin %",
    col_actions: "Action",

    // Khata
    khata_title: "Khata Recovery & Safe Mark Credit Intelligence",
    total_receivable: "Total Receivables",
    overdue_30d: "30+ Days Overdue (Severe Risk)",
    safemark_score: "Safe Mark Credit Score",
    send_whatsapp_btn: "Send WhatsApp Reminder",
    record_payment_btn: "Record Payment Received",

    // Copilot
    copilot_title: "HisaabAI Store Copilot",
    copilot_placeholder: "Ask anything about your store (Roman Urdu / English)...",
    copilot_ask_reorder: "What should I buy with PKR 50,000?",
    copilot_ask_deadstock: "Which items are dead stock?",
    copilot_ask_margin: "Where am I losing profit margin?",
    copilot_ask_wasooli: "Who owes the most overdue money?",
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('hisaab_lang') || 'roman_urdu';
  });

  const toggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === 'roman_urdu' ? 'english' : 'roman_urdu';
      localStorage.setItem('hisaab_lang', next);
      return next;
    });
  };

  const t = (key) => {
    return translations[language]?.[key] || translations.english[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
