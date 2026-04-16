import { prisma } from './index.js';

async function seed() {
  console.log('Seeding database...');

  // Create MCT Vision client
  const client = await prisma.client.upsert({
    where: { id: 'mct-vision-client-id' },
    update: {},
    create: {
      id: 'mct-vision-client-id',
      name: 'MCT Vision Sdn Bhd',
    },
  });

  console.log(`Client created: ${client.name}`);

  // ── Vendor Master ──────────────────────────────────────────────────────────
  // Source: MCT Vision creditor listing (all 67 active vendors)
  const tradeVendors = [
    // 4000/xxx — Direct trade creditors
    { vendorCode: '4000/A03', vendorName: 'ALCON LABORATORIES MALAYSIA SDN BHD', creditorType: 'TRADE' as const, aliases: ['Alcon Laboratories Malaysia Sdn Bhd', 'Alcon Laboratories', 'ALCON'] },
    { vendorCode: '4000/C01', vendorName: 'COLORPIA INTERNATIONAL (M) SDN BHD',  creditorType: 'TRADE' as const, aliases: ['Colorpia International (M) Sdn Bhd', 'Colorpia'] },
    { vendorCode: '4000/C02', vendorName: 'CARL ZEISS SDN BHD',                   creditorType: 'TRADE' as const, aliases: ['Carl Zeiss SDN BHD', 'Carl Zeiss Sdn Bhd', 'Carl Zeiss'] },
    { vendorCode: '4000/F01', vendorName: 'FOCUS POINT VISION CARE GROUP SDN BHD (CFR-EXT10024)', creditorType: 'TRADE' as const, aliases: ['Focus Point CFR', 'Focus Point EXT'] },
    { vendorCode: '4000/H01', vendorName: 'HOYA LENS MANUFACTURING MALAYSIA SDN BHD - TRUVIEW', creditorType: 'TRADE' as const, aliases: ['Hoya Lens Manufacturing Malaysia Truview', 'Hoya Truview', 'HOYA TRUVIEW'] },
    { vendorCode: '4000/H02', vendorName: 'HOYA LENS MANUFACTURING MALAYSIA SDN BHD (INST)',    creditorType: 'TRADE' as const, aliases: ['Hoya Lens Inst', 'HOYA INST', 'Hoya Instrument'] },
    { vendorCode: '4000/I01', vendorName: 'ILT OPTICS (M) SDN BHD',               creditorType: 'TRADE' as const, aliases: ['ILT OPTICS (M) SDN BHD', 'ILT Optics (M) Sdn Bhd', 'ILT Optics'] },
    { vendorCode: '4000/I02', vendorName: 'IGEL SDN BHD',                          creditorType: 'TRADE' as const, aliases: ['Igel Sdn Bhd', 'IGEL'] },
    { vendorCode: '4000/N02', vendorName: 'NOVARTIS CORPORATION (MALAYSIA) SDN BHD', creditorType: 'TRADE' as const, aliases: ['Novartis Corporation Malaysia', 'Novartis'] },
    { vendorCode: '4000/P01', vendorName: 'PHARMAFORTE (MALAYSIA) SDN BHD',        creditorType: 'TRADE' as const, aliases: ['Pharmaforte Malaysia Sdn Bhd', 'Pharmaforte'] },
    { vendorCode: '4000/T03', vendorName: 'TECHNO LENS SDN BHD',                   creditorType: 'TRADE' as const, aliases: ['Techno Lens Sdn. Bhd.', 'Techno Lens'] },
    // FV — Focus Point HQ trade
    { vendorCode: 'FV100001', vendorName: 'FOCUS POINT VISION CARE GROUP SDN BHD', creditorType: 'TRADE' as const, aliases: ['Focus Point Vision Care Group Sdn Bhd', 'Focus Point (Trade)', 'FP HQ Trade', 'FOCUS POINT VISION CARE GROUP'] },
    // VTLO — Centralised trade creditors
    { vendorCode: 'VTLO10010005', vendorName: 'BAUSCH & LOMB (MALAYSIA) SDN BHD',             creditorType: 'TRADE' as const, aliases: ['Bausch & Lomb (M) Sdn Bhd', 'Bausch & Lomb Malaysia Sdn Bhd', 'BAUSCH + LOMB', 'Bausch & Lomb'] },
    { vendorCode: 'VTLO10010014', vendorName: 'COOPER VISION CONTACT LENS MALAYSIA SDN BHD',  creditorType: 'TRADE' as const, aliases: ['CooperVision Contact Lens Malaysia Sdn. Bhd.', 'CooperVision', 'Cooper Vision'] },
    { vendorCode: 'VTLO10010015', vendorName: 'CARL ZEISS VISION (MALAYSIA) SDN BHD',         creditorType: 'TRADE' as const, aliases: ['Carl Zeiss Vision Malaysia', 'Carl Zeiss Vision'] },
    { vendorCode: 'VTLO10010019', vendorName: 'DKSH MALAYSIA SDN BHD',                        creditorType: 'TRADE' as const, aliases: ['DKSH Malaysia Sdn Bhd', 'DKSH'] },
    { vendorCode: 'VTLO10010022', vendorName: 'ESSILORLUXOTICCA MALAYSIA SDN BHD',            creditorType: 'TRADE' as const, aliases: ['EssiorLuxottica Malaysia Sdn Bhd', 'ESSILORLUXOTTICA', 'Essilor Malaysia', 'ESSILORLUXOTICCA MALAYSIA SDN BHD (FKA ESSILOR (MALAYSIA) SDN BHD)'] },
    { vendorCode: 'VTLO10010023', vendorName: 'EYESTATION SDN BHD',                           creditorType: 'TRADE' as const, aliases: ['Eyestation Sdn Bhd'] },
    { vendorCode: 'VTLO10010028', vendorName: 'ILENS SDN BHD',                                creditorType: 'TRADE' as const, aliases: ['iLens Sdn Bhd', 'ILENS'] },
    { vendorCode: 'VTLO10010030', vendorName: 'HORIZONE EYEWEAR SDN BHD',                     creditorType: 'TRADE' as const, aliases: ['Horizone Eyewear Sdn Bhd', 'Horizone'] },
    { vendorCode: 'VTLO10010031', vendorName: 'APPLE VISION SDN BHD',                         creditorType: 'TRADE' as const, aliases: ['Apple Vision Sdn Bhd'] },
    { vendorCode: 'VTLO10010040', vendorName: 'HOYA LENS MANUFACTURING MALAYSIA SDN BHD',     creditorType: 'TRADE' as const, aliases: ['Hoya Lens Manufacturing Malaysia', 'HOYA LENS MANUFACTURING', 'Hoya Manufacturing'] },
    { vendorCode: 'VTLO10010046', vendorName: 'MENICON OCULUS (M) SDN BHD',                   creditorType: 'TRADE' as const, aliases: ['Menicon Oculus (M) Sdn Bhd', 'Menicon Group', 'MENICON OCULUS (M) SDN BHD'] },
    { vendorCode: 'VTLO10010054', vendorName: 'SUMMIT COMPANY (M) SDN BHD',                   creditorType: 'TRADE' as const, aliases: ['Summit Company (M) S/B', 'Summit Company'] },
    { vendorCode: 'VTLO10010123', vendorName: 'OPTIC WORLD ENTERPRISE SDN BHD',               creditorType: 'TRADE' as const, aliases: ['Optic World Enterprise Sdn Bhd'] },
    { vendorCode: 'VTLO10010217', vendorName: 'BLINCON (M) SDN BHD',                          creditorType: 'TRADE' as const, aliases: ['Blincon (M) Sdn Bhd', 'BLINCON'] },
    { vendorCode: 'VTLO10010240', vendorName: 'JOHNSON & JOHNSON SDN BHD',                    creditorType: 'TRADE' as const, aliases: ['Johnson & Johnson Sdn. Bhd.', 'J&J', 'Johnson And Johnson'] },
    { vendorCode: 'VTLO10010321', vendorName: 'EYE MEDITECH SDN BHD',                         creditorType: 'TRADE' as const, aliases: ['Eye Meditech Sdn Bhd'] },
    { vendorCode: 'VTLO10010330', vendorName: 'PEARL VISION OPTHALMIC LENS SDN. BHD.',        creditorType: 'TRADE' as const, aliases: ['Pearl Vision Ophthalmic Lens Sdn. Bhd.', 'PEARL VISION OPTHALMIC LENS SDN. BHD.', 'Pearl Vision'] },
    { vendorCode: 'VTLO10010332', vendorName: 'LENSMAX EDGING LAB',                           creditorType: 'TRADE' as const, aliases: ['Lensmax Edging Lab'] },
    { vendorCode: 'VTLO10010333', vendorName: 'SP VISIONCARE SDN BHD',                        creditorType: 'TRADE' as const, aliases: ['SP Visioncare Sdn Bhd'] },
    { vendorCode: 'VTLO10010369', vendorName: 'FIRSTLOOK EYEWEAR SDN BHD',                    creditorType: 'TRADE' as const, aliases: ['Firstlook Eyewear Sdn Bhd'] },
    { vendorCode: 'VTLO10010370', vendorName: 'BIONICS SCIENCES SDN BHD',                     creditorType: 'TRADE' as const, aliases: ['Bionics Sciences Sdn Bhd'] },
    { vendorCode: 'VTLO10010422', vendorName: 'DCH AURIGA (MALAYSIA) SDN BHD',                creditorType: 'TRADE' as const, aliases: ['DCH Auriga Malaysia Sdn Bhd', 'DCH Auriga'] },
    { vendorCode: 'VTLO10010444', vendorName: 'OPTOLAB SDN BHD',                              creditorType: 'TRADE' as const, aliases: ['Optolab Sdn Bhd'] },
    { vendorCode: 'VTLO10010457', vendorName: 'MALAYSIAN HOYA LENS SDN BHD',                  creditorType: 'TRADE' as const, aliases: ['Malaysian Hoya Lens Sdn. Bhd.', 'Malaysian Hoya Lens SDN. BHD.', 'Hoya Lens'] },
    { vendorCode: 'VTLO10010529', vendorName: 'ADVANCE LENS TRADING',                         creditorType: 'TRADE' as const, aliases: ['Advance Lens Trading (000658792-T)', 'Advance Lens Trading', 'ADV LENS'] },
    { vendorCode: 'VTLO10010530', vendorName: 'DORICON OPTICS INTERNATIONAL SDN BHD',         creditorType: 'TRADE' as const, aliases: ['Doricon Optics International Sdn Bhd', 'Doricon Optics'] },
    { vendorCode: 'VTLO10010553', vendorName: 'KWONG MING MALAYSIA SDN BHD',                  creditorType: 'TRADE' as const, aliases: ['Kwong Ming Malaysia Sdn Bhd'] },
  ];

  const nonTradeVendors = [
    // 4001/Fxx — Focus Point group entities
    { vendorCode: '4001/F01', vendorName: 'FOCUS POINT - NON-TRADE',                                  creditorType: 'OTHERS' as const, aliases: ['Focus Point (Non-Trade)', 'Focus Point Non-Trade', 'FOCUS POINT - NON-TRADE'] },
    { vendorCode: '4001/F02', vendorName: 'FOCUS POINT - INITIAL',                                    creditorType: 'OTHERS' as const, aliases: ['Focus Point Initial', 'FP Initial'] },
    { vendorCode: '4001/F03', vendorName: 'FOCUS POINT MANAGEMENT SDN BHD',                           creditorType: 'OTHERS' as const, aliases: ['Focus Point Management', 'FP Management'] },
    { vendorCode: '4001/F04', vendorName: 'FOCUS POINT MANAGEMENT - FRANCHISE FEE',                   creditorType: 'OTHERS' as const, aliases: ['FP Management Franchise Fee'] },
    { vendorCode: '4001/F05', vendorName: 'FOCUS POINT VISION CARE GROUP SDN BHD (ROYALTY)',          creditorType: 'OTHERS' as const, aliases: ['Focus Point Royalty', 'FP Royalty', 'FOCUS POINT VISION CARE GROUP SDN BHD (ROYALTY)'] },
    { vendorCode: '4001/F06', vendorName: 'FOCUS POINT VISION CARE GROUP SDN BHD (FRANCHISE FEE)',    creditorType: 'OTHERS' as const, aliases: ['Focus Point Franchise', 'FP Franchise Fee', 'FOCUS POINT VISION CARE GROUP SDN BHD (FRANCHISE FEE)'] },
    // 4001/Axx — Insurance
    { vendorCode: '4001/A01', vendorName: 'ALLIANZ GENERAL INSURANCE COMPANY (MALAYSIA) BERHAD',      creditorType: 'OTHERS' as const, aliases: ['Allianz General Insurance', 'Allianz'] },
    { vendorCode: '4001/A02', vendorName: 'AMGENERAL INSURANCE BERHAD',                               creditorType: 'OTHERS' as const, aliases: ['AmGeneral Insurance', 'AmGeneral'] },
    { vendorCode: '4001/M03', vendorName: 'MSIG INSURANCE (MALAYSIA) BHD',                            creditorType: 'OTHERS' as const, aliases: ['MSIG Insurance Malaysia', 'MSIG'] },
    // 4001/Cxx — Professional / Legal
    { vendorCode: '4001/C01', vendorName: 'CHEANG & ARIF',                                            creditorType: 'OTHERS' as const, aliases: ['Cheang and Arif', 'Cheang & Arif'] },
    // 4001/Dxx — Office supplies
    { vendorCode: '4001/D01', vendorName: 'DSOP OFFICE SYSTEM & SUPPLIES SDN BHD',                    creditorType: 'OTHERS' as const, aliases: ['DSOP Office System', 'DSOP'] },
    // 4001/Gxx — Courier
    { vendorCode: '4001/G01', vendorName: 'GD EXPRESS SDN BHD',                                       creditorType: 'OTHERS' as const, aliases: ['GD Express Sdn Bhd', 'GDEX', 'GDEx'] },
    // 4001/Jxx — Professional
    { vendorCode: '4001/J01', vendorName: 'JOVANI & CO',                                              creditorType: 'OTHERS' as const, aliases: ['Jovani and Co', 'Jovani & Co'] },
    { vendorCode: '4001/J02', vendorName: 'JAYASANGAR & CO',                                          creditorType: 'OTHERS' as const, aliases: ['Jayasangar and Co', 'Jayasangar & Co'] },
    // 4001/Mxx — Telecom, misc
    { vendorCode: '4001/M01', vendorName: 'MALAYSIA HOYA LENS (MACHINE GT-3000)',                     creditorType: 'OTHERS' as const, aliases: ['Malaysia Hoya Lens Machine'] },
    { vendorCode: '4001/M02', vendorName: 'MAXIS MOBILE SERVICES SDN BHD',                            creditorType: 'OTHERS' as const, aliases: ['Maxis Mobile Services', 'Maxis Mobile'] },
    { vendorCode: '4001/M04', vendorName: 'MAXIS BROADBAND SDN BHD',                                  creditorType: 'OTHERS' as const, aliases: ['Maxis Broadband Sdn Bhd', 'Maxis Broadband', 'Maxis'] },
    { vendorCode: '4001/M05', vendorName: 'M SPACE ADVERTISING DESIGN',                               creditorType: 'OTHERS' as const, aliases: ['M Space Advertising', 'MSpace'] },
    // 4001/Nxx — Courier / trade
    { vendorCode: '4000/N01', vendorName: 'NATIONWIDE EXPRESS COURIER SERVICE BERHAD',                creditorType: 'OTHERS' as const, aliases: ['Nationwide Express', 'Nationwide Courier'] },
    // 4001/Oxx — Instruments
    { vendorCode: '4001/O01', vendorName: 'OPHTHALMATIC INSTRUMENTS (M) SDN BHD',                     creditorType: 'OTHERS' as const, aliases: ['Ophthalmatic Instruments Malaysia', 'Ophthalmatic Instruments'] },
    // 4001/Pxx — Payment solutions
    { vendorCode: '4001/P01', vendorName: 'PINE PAYMENT SOLUTIONS SDN BHD',                           creditorType: 'OTHERS' as const, aliases: ['Pine Payment Solutions', 'Pine Payment'] },
    // 4001/Qxx — IT
    { vendorCode: '4001/Q01', vendorName: 'QSD COMPUTER DISTRIBUTION SDN BHD',                        creditorType: 'OTHERS' as const, aliases: ['QSD Computer', 'QSD'] },
    // 4001/Rxx — Professional services (accounting, tax, secretarial)
    { vendorCode: '4001/R01', vendorName: 'RELIANT MANAGEMENT CONSULTANCY SDN BHD',                   creditorType: 'OTHERS' as const, aliases: ['Reliant Management Consultancy Sdn Bhd', 'Reliant Management', 'Reliant'] },
    { vendorCode: '4001/R02', vendorName: 'RELIANT TAX SERVICES SDN BHD',                             creditorType: 'OTHERS' as const, aliases: ['Reliant Tax Services Sdn Bhd', 'Reliant Tax'] },
    { vendorCode: '4001/R03', vendorName: 'RNT USAHASAMA ENTERPRISE',                                 creditorType: 'OTHERS' as const, aliases: ['RNT Usahasama Enterprise', 'RNT'] },
    { vendorCode: '4001/S01', vendorName: 'SK & ASSOCIATES',                                          creditorType: 'OTHERS' as const, aliases: ['SK and Associates', 'SK & Associates'] },
    // 4001/Txx — Utilities
    { vendorCode: '4001/T01', vendorName: 'TENAGA NASIONAL BERHAD',                                   creditorType: 'OTHERS' as const, aliases: ['TNB', 'Tenaga Nasional', 'TENAGA NASIONAL BERHAD'] },
    { vendorCode: '4001/T02', vendorName: 'TELEKOM MALAYSIA BERHAD',                                  creditorType: 'OTHERS' as const, aliases: ['TM', 'Telekom Malaysia', 'Unifi', 'Unifi TM', 'TELEKOM MALAYSIA BERHAD'] },
  ];

  for (const v of [...tradeVendors, ...nonTradeVendors]) {
    await prisma.vendorMaster.upsert({
      where: { id: `${client.id}-${v.vendorCode}` },
      update: { vendorName: v.vendorName, aliases: v.aliases, creditorType: v.creditorType },
      create: {
        id: `${client.id}-${v.vendorCode}`,
        clientId: client.id,
        vendorName: v.vendorName,
        vendorCode: v.vendorCode,
        creditorType: v.creditorType,
        aliases: v.aliases,
      },
    });
  }

  console.log(`Seeded ${tradeVendors.length + nonTradeVendors.length} vendors`);

  // ── Chart of Accounts ──────────────────────────────────────────────────────
  // Source: MCT Vision Standard Ledger — expense + purchase accounts only
  // Priority: vendor override > keyword match
  const glAccounts = [
    // ── Trade optical suppliers → 6011/000 PURCHASES - OTHER SUPPLIES ──────
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010457' }, // Malaysian Hoya Lens
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/I01' },     // ILT Optics
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010005' }, // Bausch & Lomb
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/A03' },     // Alcon
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010022' }, // EssiorLuxottica
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010330' }, // Pearl Vision
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010529' }, // Advance Lens
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010530' }, // Doricon Optics
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010014' }, // CooperVision
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010046' }, // Menicon Oculus
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010030' }, // Horizone Eyewear
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010321' }, // Eye Meditech
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/T03' },     // Techno Lens
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/C02' },     // Carl Zeiss
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010240' }, // Johnson & Johnson
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010123' }, // Optic World
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010019' }, // DKSH
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/C01' },     // Colorpia
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/H01' },     // Hoya Truview
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/H02' },     // Hoya Inst
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/I02' },     // IGEL
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/N02' },     // Novartis
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: '4000/P01' },     // Pharmaforte
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010015' }, // Carl Zeiss Vision
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010023' }, // Eyestation
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010028' }, // iLens
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010031' }, // Apple Vision
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010040' }, // Hoya Lens Manufacturing
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010054' }, // Summit Company
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010217' }, // Blincon
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010332' }, // Lensmax
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010333' }, // SP Visioncare
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010369' }, // Firstlook Eyewear
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010370' }, // Bionics Sciences
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010422' }, // DCH Auriga
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010444' }, // Optolab
    { glCode: '6011/000', glLabel: 'Purchases - Other Supplies', keywords: [], vendorCodeOverride: 'VTLO10010553' }, // Kwong Ming
    // ── Focus Point HQ trade → 6010/000 PURCHASES - HQ ─────────────────────
    { glCode: '6010/000', glLabel: 'Purchases - HQ', keywords: [], vendorCodeOverride: 'FV100001' },
    { glCode: '6010/000', glLabel: 'Purchases - HQ', keywords: [], vendorCodeOverride: '4000/F01' },
    // ── Focus Point franchise / royalty ──────────────────────────────────────
    { glCode: '2090/000', glLabel: 'Franchise Fee', keywords: [], vendorCodeOverride: '4001/F06' },
    { glCode: '2090/000', glLabel: 'Franchise Fee', keywords: [], vendorCodeOverride: '4001/F04' },
    // ── Utilities ────────────────────────────────────────────────────────────
    { glCode: '9C08/003', glLabel: 'Electricity', keywords: [], vendorCodeOverride: '4001/T01' },      // TNB
    { glCode: '9C07/002', glLabel: 'Internet/Unifi/Streamyx', keywords: [], vendorCodeOverride: '4001/T02' }, // Telekom
    { glCode: '9C07/003', glLabel: 'Handphone - Maxis', keywords: [], vendorCodeOverride: '4001/M04' }, // Maxis Broadband
    { glCode: '9C07/003', glLabel: 'Handphone - Maxis', keywords: [], vendorCodeOverride: '4001/M02' }, // Maxis Mobile
    // ── Courier / transport ───────────────────────────────────────────────────
    { glCode: '9C09/000', glLabel: 'Transportation & Courier', keywords: [], vendorCodeOverride: '4001/G01' }, // GDEX
    { glCode: '9C09/000', glLabel: 'Transportation & Courier', keywords: [], vendorCodeOverride: '4000/N01' }, // Nationwide Express
    // ── Professional fees — vendor overrides (more precise than keywords) ─────
    { glCode: '9D11/000', glLabel: 'Accounting Fee', keywords: [], vendorCodeOverride: '4001/R01' },    // Reliant Management
    { glCode: '9D14/000', glLabel: 'Tax Agent Fee',  keywords: [], vendorCodeOverride: '4001/R02' },    // Reliant Tax
    { glCode: '9D12/000', glLabel: 'Secretarial Fee', keywords: [], vendorCodeOverride: '4001/S01' },   // SK & Associates
    { glCode: '9D12/000', glLabel: 'Secretarial Fee', keywords: [], vendorCodeOverride: '4001/C01' },   // Cheang & Arif
    // ── Insurance ─────────────────────────────────────────────────────────────
    { glCode: '9D04/000', glLabel: 'Insurance & Road Tax', keywords: [], vendorCodeOverride: '4001/A01' }, // Allianz
    { glCode: '9D04/000', glLabel: 'Insurance & Road Tax', keywords: [], vendorCodeOverride: '4001/A02' }, // AmGeneral
    { glCode: '9D04/000', glLabel: 'Insurance & Road Tax', keywords: [], vendorCodeOverride: '4001/M03' }, // MSIG
    // ── Office supplies / stationery ──────────────────────────────────────────
    { glCode: '9D02/000', glLabel: 'Printing & Stationery', keywords: [], vendorCodeOverride: '4001/D01' }, // DSOP
    // ── Advertising ────────────────────────────────────────────────────────────
    { glCode: '9C03/000', glLabel: 'Advertisement & Promotion', keywords: [], vendorCodeOverride: '4001/M05' }, // M Space
    // ── Keyword-based rules (FP Non-Trade invoices & general matching) ────────
    { glCode: '9C13/000', glLabel: 'Royalty Fee',             keywords: ['ROYALTY FEE', 'ROYALTEE FEE'] },
    { glCode: '3500/001', glLabel: 'Sinking Fund',            keywords: ['SINKING FUND', 'OUTLET MAINTENANCE DEPOSIT'] },
    { glCode: '9C01/000', glLabel: 'Rental of Premise',       keywords: ['RENTAL', 'REBILL FOR RENTAL', 'LOTUSS SG PETANI MUTIARA:REBILL FOR RENTAL'] },
    { glCode: '9C15/000', glLabel: 'Tenant Sales Commission', keywords: ['SALES COMM', 'REBILL FOR SALES COMM', 'CN FOR SALES COMM'] },
    { glCode: '9C04/000', glLabel: 'Bonuslink Expenses',      keywords: ['BONUSLINK'] },
    { glCode: '3002/004', glLabel: 'Cash Voucher',            keywords: ['G-FLEX', 'PMCARE', 'AIA', 'MICARE', 'MEDKAD', 'MBPP', 'HEALTHMETRICS', 'BACKEND CORP CUST', 'MEDNEFITS', 'CN FOR'] },
    { glCode: '9D02/000', glLabel: 'Printing & Stationery',   keywords: ['FAX ORDER', 'A4 STD', 'STANDEE', 'RECYCLE PAPER BAG', 'PAPER BAG'] },
    { glCode: '9D12/000', glLabel: 'Secretarial Fee',         keywords: ['SECRETARIAL FEE', 'SEC FEE'] },
    { glCode: '9D11/000', glLabel: 'Accounting Fee',          keywords: ['ACCOUNTING FEE', 'ACC FEE'] },
    { glCode: '9D13/000', glLabel: 'Audit Fee',               keywords: ['AUDIT FEE'] },
    { glCode: '9D14/000', glLabel: 'Tax Agent Fee',           keywords: ['TAX AGENT FEE'] },
    { glCode: '6025/000', glLabel: 'Purchases - Discount Allowed', keywords: ['PROMPT PAYMENT', 'CASH DISCOUNT', 'PMT DIS'] },
    { glCode: '6021/000', glLabel: 'Purchases Returned - Other Supplies', keywords: ['GOODS RETURNED', 'RETURN'] },
    { glCode: '9D24/000', glLabel: 'SST Expenses',            keywords: ['SERVICE TAX', 'SST'] },
    { glCode: '9D21/000', glLabel: 'Service/Admin Charge',    keywords: ['ADMIN FEE', 'SERVICE CHARGE', 'SERVICE/ADMIN'] },
    { glCode: '9C03/000', glLabel: 'Advertisement & Promotion', keywords: ['ADVERTISING', 'ADVERTISEMENT', 'PROMOTION'] },
    { glCode: '9D04/000', glLabel: 'Insurance & Road Tax',    keywords: ['INSURANCE', 'ROAD TAX', 'BUSINESS SAFEGUARD'] },
  ];

  for (let i = 0; i < glAccounts.length; i++) {
    const gl = glAccounts[i];
    await prisma.chartOfAccount.upsert({
      where: { id: `${client.id}-gl-${i}` },
      update: { glCode: gl.glCode, glLabel: gl.glLabel, keywords: gl.keywords, vendorCodeOverride: gl.vendorCodeOverride ?? null },
      create: {
        id: `${client.id}-gl-${i}`,
        clientId: client.id,
        glCode: gl.glCode,
        glLabel: gl.glLabel,
        keywords: gl.keywords,
        vendorCodeOverride: gl.vendorCodeOverride ?? null,
      },
    });
  }

  console.log(`Seeded ${glAccounts.length} GL account rules`);
  console.log('Seeding complete!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
