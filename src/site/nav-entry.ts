import "../styles.css";
import { initLocaleFromLocation } from "../i18n/strings";
import { initLangPicker, initNav } from "./nav";
import { initBmcTracking, initWalletCopy } from "./wallets";

initLocaleFromLocation();
initNav();
initLangPicker();
initWalletCopy();
initBmcTracking();
