// ==UserScript==
// @name         IQRPG Dungeon Companion
// @namespace    https://www.iqrpg.com/
// @version      0.1.1
// @author       Tempest
// @description  QoL enhancement for IQRPG Dungeons
// @homepage     https://slyboots.studio/iqrpg-dungeon-companion/
// @source       https://github.com/SlybootsStudio/iqrpg-dungeon-companion
// @match        https://*.iqrpg.com/*
// @require      http://code.jquery.com/jquery-latest.js
// @license      unlicense
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/498244/IQRPG%20Dungeon%20Companion.user.js
// @updateURL https://update.greasyfork.org/scripts/498244/IQRPG%20Dungeon%20Companion.meta.js
// ==/UserScript==

/* global $ */

/*
 * Special thanks to Ciomegu for formula feedback
 */

//-----------------------------------------------------------------------
// Config
//-----------------------------------------------------------------------




/*              Tokens, Index, Name */
const TOKENS = [20, // 0 - Goblin
                25, // 1 - Mountain
                30, // 2 - Tomb
                35, // 3 - Lair
                40, // 4 - Ruins
                40, // 5 - Tower
                50, // 6 - Cells
                60, // 7 - Hall
               100, // 8 - Vault
               150];// 9 - Treasury

/**
 * Identify which key is used for the estimates on the Token Store
 * To change, use the Index (0-9) from the list above.
 */
const INDEX_FOR_ESTIMATE = 0; // Default, 1 - Goblin Key

/**
 * Modify the token store page to show additional keys estimates.
 */
const MODIFY_TOKEN_STORE = 1; // 1 - Yes, 0 - No

/**
 * Used to store the Dungeon Keeper stats when you navigate from
 * the Personnel page, to the Dungeons and Token Store page.
 */
const CACHE_DUNGEON = "cache_dungeon"; // Cache for all the


const RENDER_DELAY = 100; // Delay for modifying the page.


const RARITY_BONUS = 5; // Bonus (percent) per Rarity Level.
const MAX_BONUS = 1.65; // 65% is the maximum for bonus tokens.

//-----------------------------------------------------------------------
// CACHE
//-----------------------------------------------------------------------
/* We are caching the Dungeon Keeper stats,
 * which are updated each time the personnel page is visited.
 */
function writeCache( key, data ) {
  localStorage[key] = JSON.stringify(data);
}

function readCache( key ) {
  return JSON.parse(localStorage[key] || null) || localStorage[key];
}


//-----------------------------------------------------------------------
// Util
//-----------------------------------------------------------------------

/**
 * Bonus percent by level
 */
function bonusByLevel(level) {
    if(level < 50) return 0;
    if(level < 75) return 2;
    if(level < 100) return 5;
    if(level < 125) return 10;
    if(level < 150) return 20;

    return 40;
}

/**
 * Bonus percent by rarity
 */
function bonusTokens(rarity, level) {
    let percent = 0;
    rarity -= 1; // Rarity 1 (Common) doesn't apply any bonus, so we subtract it.
    percent += rarity * RARITY_BONUS; // Each rarity level after common.
    percent += bonusByLevel(level);

    return percent;
}

/**
 * The multiplier used in the total token calculation
 */
function bonusMultiplier() {

    const dkStats = readCache(CACHE_DUNGEON);

    const rarity = dkStats?.rarity || 0;
    const level = dkStats?.level || 0;
    const bonusPercent = bonusTokens(rarity, level);
    
    if(bonusPercent < 0) {
        bonusPercent = 0;
    }
    const bonusMultiplier = (1 + bonusPercent / 100);
    
    return bonusMultiplier;
}


/**
 * Used to debounce DOM modifications
 */
let loadDungeonsOnce = false;
let loadPersonnelOnce = false;
let loadTokenStoreOnce = false;

function onReadyStateChangeReplacement() {
    //
    // This is called anytime there is an action complete, or a view (page) loads.
    // console.log('Response URL', this.responseURL);
    //


    /**
     * Remove the message at the top of the Dungeon page, only if we've left the Dungeon page.
     */
    let accordians = $('.main-game-section .main-section__body .accordian');
    if(accordians.length !== TOKENS.length) { // Each dungeon has a accordion.
      $('.removeMe').remove();
    }

    setTimeout( () => {

        /**
         * Token Store page.
         *
         * Modify the table to show how many remaining keys need to be used, with various
         * amounts of bonus tokens applied.
         */
        if(this.responseURL.includes("php/store.php?mod=tokenStore")) {

            /**
             * User has disabled this modification in the config above.
             * Don't modify the page.
             */
            if(!MODIFY_TOKEN_STORE)
                return;


            if(this.response && !loadTokenStoreOnce) {

                loadTokenStoreOnce = true;


                /**
                 * Get current Dungeoneering Tokens
                 * [0] is the Boss Tokens, [1] is the Jewel Slots
                 */
                let header = $('.main-game-section .main-section__body .heading')[1]; // Jewel Slots header
                let currentTokens = $(header).next().text(); // Get siblining element below the header
                    currentTokens = currentTokens.replace('[Dungeoneering Tokens]: ', ''); // Remove text
                    currentTokens = currentTokens.replaceAll(',', ''); // Remove commas
                    currentTokens = parseInt(currentTokens); // Convert to int


                /**
                 * Modify the Jewel Slots table.
                 * [0] is the Boss Tokens, [1] is the Jewel Slots
                 */
                let table = $('.main-game-section .main-section__body table')[1];
                const trs = $('tr', table);

                let bonus = Math.round((bonusMultiplier() - 1) * 100);

                /**
                 * Extend table headers
                 */
                $(trs[0]).append(`<td class='text-rarity-1'>No Bonus</td>`);
                $(trs[0]).append(`<td class='text-rarity-1'>Current Bonus (${bonus}%)</td>`);
                $(trs[0]).append(`<td class='text-rarity-1'>Max Bonus (65%)</td>`);

                /**
                 * Extend the rows
                 */
                for(let i = 1; i < trs.length; i += 1) { // Skipping header
                    let td = $('td', trs[i]);
                    let tokens = $(td[2]).text(); // Type [0], Current/Max [1], Tokens [2]
                    tokens = tokens.replaceAll(',', ''); // Remove commas
                    tokens = parseInt(tokens); // Convert to int

                    tokens -= currentTokens; // Account for acrued tokens

                    if(tokens < 0) tokens = 0; // Avoid this delightful error.

                    const keys = Math.ceil(tokens / TOKENS[INDEX_FOR_ESTIMATE]);
                    const keysBonus = Math.ceil(tokens / Math.round(TOKENS[INDEX_FOR_ESTIMATE] * bonusMultiplier())); //1.x
                    const keysMax = Math.ceil(tokens / Math.round(TOKENS[INDEX_FOR_ESTIMATE] * MAX_BONUS)); // 1.65
                    $(trs[i]).append(`<td>${keys.toLocaleString()}</td>`);
                    $(trs[i]).append(`<td>${keysBonus.toLocaleString()}</td>`);
                    $(trs[i]).append(`<td>${keysMax.toLocaleString()}</td>`);
                    // toLocaleString() adds commas, or periods depending on locale.
                }

                /**
                 * Add a note to the page, explaining the extra columns.
                 */
                $(table).after("<br/><p>The `No`, `Current`, and `Max` numbers represent the keys to run to buy the slot.</p>");

            }
        } else {
            loadTokenStoreOnce = false;
        }

        /**
         * Personnel page.
         *
         * Read and cache the dungeon keeper information.
         */
        if(this.responseURL.includes("php/land.php?mod=loadPersonnel")) {
            if(this.response && !loadPersonnelOnce) {

                loadPersonnelOnce = true;

                const dkStats = JSON.parse(this.response).personnel.dungeon_keeper;
                const payload = {
                    level: dkStats.level, rarity : dkStats.rarity
                };

                writeCache(CACHE_DUNGEON, payload);
            }
        } else {
            loadPersonnelOnce = false;
        }

        /**
         * Dungeons page.
         *
         * Display the total tokens you could earn from each type of key, and total.
         */
        if(this.responseURL.includes("php/areas.php?mod=loadDungeons")) {

            if(this.response && !loadDungeonsOnce) {

                $('.removeMe').remove(); // Remove a previous one

                loadDungeonsOnce = true;

                const dungeonsCount = $('.accordian__item').length;

                let grandTotal = 0;

                for(let i = 0; i < dungeonsCount; i +=1) {
                    /**
                     * Find the amount of keys for each dungeon
                     */
                    let acc = $('.accordian__item')[i]; // Accordion
                    let rightContent = $('div', acc)[1]; // [0] - Dungeon Name, [1] - Amount and Key
                    let amount = $(rightContent).text().split('x ')[0]; // Amountx [Key Name] -- Get Amount
                    const total = amount * Math.round(TOKENS[i] * bonusMultiplier()); // total tokens

                    /**
                     * Modify existing DOM element with total tokens available.
                     */
                    $(rightContent).prepend(`<span class='text-rarity-1'>${total.toLocaleString()} tokens</span> - `);

                    grandTotal += total; // add total to running grand total
                }

                let header = `<span class='removeMe'>`;
                 /**
                  * Usually we're modifying an element which is re-rendered.
                  * In this case, we're not. So we need to remove it ourselves.
                  */

                /**
                 * Read from cache, set defaults in case Personnel page has not been visited.
                 */
                const dkStats = readCache(CACHE_DUNGEON);
                const rarity = dkStats?.rarity || 0;
                const level = dkStats?.level || 0; // Untrained, it would be level 1.
                const bonusPercent = bonusTokens(rarity, level);


                if(!level) {
                    /**
                     * User has not visited the Personnel page yet.
                     */
                    header += `<p>Userscript not synced with your <span class='green-text'>Dungeon Keeper</span>. `;
                    header += `Visit your Personnel to update the token calculation.</p><br/>`;
                } else {
                    /**
                     * Display the cached Dungeon Keeper stats.
                     */
                    header += `<p>Your <span class='text-rarity-${rarity}'>Dungeon Keeper</span> (Level <span class='green-text'>${level}</span>)</span> - ${bonusPercent}% Bonus</p></br>`;
                }

                /**
                 * Display the grand total amount of tokens.
                 */
                header += `<p><b><span class='text-rarity-1'>${grandTotal.toLocaleString()} tokens</b></span> total.</p><br/></span>`;

                $('.main-game-section .main-section__body').prepend(header);

            }
        } else {
            loadDungeonsOnce = false;
        }

    }, RENDER_DELAY );
}

//-----------------------------------------------------------------------
// HTTP Request Override -- DO NOT EDIT
//-----------------------------------------------------------------------
let send = window.XMLHttpRequest.prototype.send;

function sendReplacement(data) {
    if(this.onreadystatechange) {
        this._onreadystatechange = this.onreadystatechange;
    }

    this.onreadystatechange = onReadyStateChangeReplacement;
    return send.apply(this, arguments);
}

window.XMLHttpRequest.prototype.send = sendReplacement;
