class SurebetHunter {
    constructor() {
        this.apiKey = localStorage.getItem('oddsApiKey') || '';
        this.apiUrl = 'https://api.the-odds-api.com/v4/sports';
        this.surebets = [];
        this.executedSurebets = JSON.parse(localStorage.getItem('executedSurebets') || '[]');
        this.stats = { 
            today: 0, 
            avgProfit: 0, 
            successRate: 0, 
            activeBookmakers: 0 
        };
        this.updateInterval = null;
        this.mockMode = true;
        this.bookmakerLinks = {
            'SuperBet': 'https://superbet.bet.br/',
            'Bet365': 'https://www.bet365.bet.br/#/HO/',
            'KTO': 'https://www.kto.bet.br/',
            'BetMGM': 'https://www.betmgm.bet.br/',
            'Betfair': 'https://www.betfair.bet.br/apostas/',
            'Betway': 'https://betway.com.br',
            'Sportingbet': 'https://sportingbet.com.br',
            'Pinnacle': 'https://pinnacle.com'
        };
        
        this.init();
    }

    init() {
        this.loadSavedConfig();
        this.generateMockData();
        this.startAutoUpdate();
    }

    loadSavedConfig() {
        if (this.apiKey) {
            document.getElementById('apiKey').value = this.apiKey;
        }
    }

    generateMockData() {
        const mockGames = [
            {
                id: this.generateId(),
                match: "Liverpool vs Manchester City",
                league: "Premier League",
                market: "1x2",
                homeTeam: "Liverpool",
                awayTeam: "Manchester City",
                odds: { 
                    home: 2.613840, 
                    draw: 3.25, 
                    away: 3.589754 
                },
                bookmakers: { 
                    home: "Bet365", 
                    draw: "KTO", 
                    away: "Betfair" 
                },
                startTime: new Date(Date.now() + 150000) // 2min 30s
            },
            {
                id: this.generateId(),
                match: "Real Madrid vs Barcelona",
                league: "La Liga",
                market: "Over/Under 2.5",
                homeTeam: "Real Madrid",
                awayTeam: "Barcelona",
                odds: { over: 2.05, under: 1.95 },
                bookmakers: { over: "SuperBet", under: "BetMGM" },
                startTime: new Date(Date.now() + 320000) // 5min 20s
            },
            {
                id: this.generateId(),
                match: "Flamengo vs Palmeiras", 
                league: "Brasileirão Série A",
                market: "Both Teams to Score",
                homeTeam: "Flamengo",
                awayTeam: "Palmeiras",
                odds: { yes: 1.85, no: 2.15 },
                bookmakers: { yes: "KTO", no: "Betfair" },
                startTime: new Date(Date.now() + 680000) // 11min 20s
            }
        ];

        const validSurebets = [];
        
        mockGames.forEach(game => {
            let surebet = null;
            let bets = [];

            if (game.market === "1x2") {
                // Para 1x2, vamos testar combinação casa + (empate ou visitante)
                const homeOdds = game.odds.home;
                const drawAwayOdds = 1 / ((1/game.odds.draw) + (1/game.odds.away));
                
                const calc = this.calculateSurebet(homeOdds, drawAwayOdds);
                if (calc) {
                    surebet = calc;
                    bets = [
                        {
                            outcome: `Vitória ${game.homeTeam}`,
                            bookmaker: game.bookmakers.home,
                            odds: homeOdds,
                            stake: calc.stake1,
                            market: "1x2 - Vitória do Mandante"
                        },
                        {
                            outcome: `Empate ou Vitória ${game.awayTeam}`,
                            bookmaker: "BetMGM", // Usar casa diferente
                            odds: drawAwayOdds,
                            stake: calc.stake2,
                            market: "Dupla Chance X2"
                        }
                    ];
                }
            } else if (game.market === "Over/Under 2.5") {
                const calc = this.calculateSurebet(game.odds.over, game.odds.under);
                if (calc) {
                    surebet = calc;
                    bets = [
                        {
                            outcome: "Over 2.5 gols",
                            bookmaker: game.bookmakers.over,
                            odds: game.odds.over,
                            stake: calc.stake1,
                            market: "Total de Gols - Over 2.5"
                        },
                        {
                            outcome: "Under 2.5 gols",
                            bookmaker: game.bookmakers.under,
                            odds: game.odds.under,
                            stake: calc.stake2,
                            market: "Total de Gols - Under 2.5"
                        }
                    ];
                }
            } else if (game.market === "Both Teams to Score") {
                const calc = this.calculateSurebet(game.odds.yes, game.odds.no);
                if (calc) {
                    surebet = calc;
                    bets = [
                        {
                            outcome: "Ambos marcam - Sim",
                            bookmaker: game.bookmakers.yes,
                            odds: game.odds.yes,
                            stake: calc.stake1,
                            market: "Ambos Marcam - Sim"
                        },
                        {
                            outcome: "Ambos marcam - Não",
                            bookmaker: game.bookmakers.no,
                            odds: game.odds.no,
                            stake: calc.stake2,
                            market: "Ambos Marcam - Não"
                        }
                    ];
                }
            }

            if (surebet && bets.length > 0) {
                validSurebets.push({
                    ...game,
                    calculation: surebet,
                    bets: bets
                });
            }
        });

        this.surebets = validSurebets;
        this.updateStats();
        this.updateDisplay();
    }

    calculateSurebet(odds1, odds2, bankroll = 200) {
        const inverseSum = (1/odds1) + (1/odds2);
        if (inverseSum >= 1) return null; // Não é surebet
        
        const stake1 = bankroll / (1 + odds1/odds2);
        const stake2 = bankroll - stake1;
        const profit = (stake1 * odds1) - bankroll;
        const profitPercent = (profit / bankroll) * 100;
        
        const minProfit = parseFloat(document.getElementById('minProfit').value) || 3;
        if (profitPercent < minProfit || profitPercent > 25) return null; // Permitir até 25% para demonstração
        
        return {
            stake1: Math.round(stake1 * 100) / 100,
            stake2: Math.round(stake2 * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            profitPercent: Math.round(profitPercent * 100) / 100
        };
    }

    updateStats() {
        // Calcular estatísticas baseadas em dados reais
        const totalExecuted = this.executedSurebets.length;
        const todayExecuted = this.executedSurebets.filter(sb => 
            new Date(sb.executedAt).toDateString() === new Date().toDateString()
        ).length;
        
        this.stats = {
            today: this.surebets.length,
            avgProfit: this.surebets.length > 0 ? 
                Math.round(this.surebets.reduce((sum, sb) => sum + sb.calculation.profitPercent, 0) / this.surebets.length * 10) / 10 : 0,
            successRate: totalExecuted > 0 ? Math.round((todayExecuted / totalExecuted) * 100) : 100,
            activeBookmakers: new Set(this.surebets.flatMap(sb => sb.bets.map(b => b.bookmaker))).size
        };

        document.getElementById('todayCount').textContent = this.stats.today;
        document.getElementById('avgProfit').textContent = this.stats.avgProfit + '%';
        document.getElementById('successRate').textContent = this.stats.successRate + '%';
        document.getElementById('activeBookmakers').textContent = this.stats.activeBookmakers;
    }

    updateDisplay() {
        const container = document.getElementById('surebetsContainer');
        const activeSurebetsElement = document.getElementById('activeSurebets');
        
        activeSurebetsElement.textContent = this.surebets.length;
        
        if (this.surebets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>Nenhuma surebet encontrada</h3>
                    <p>O sistema continuará monitorando em tempo real</p>
                </div>
            `;
            return;
        }
        
        // Mostrar alerta se há oportunidades com lucro alto
        const highProfitOpp = this.surebets.some(sb => sb.calculation.profitPercent > 10);
        const opportunityAlert = document.getElementById('opportunityAlert');
        opportunityAlert.style.display = highProfitOpp ? 'block' : 'none';
        
        container.innerHTML = this.surebets.map(surebet => this.createSurebetCard(surebet)).join('');
        
        document.getElementById('lastUpdate').textContent = 
            `Última atualização: ${new Date().toLocaleTimeString('pt-BR')}`;
    }

    createSurebetCard(surebet) {
        const timeLeft = this.getTimeLeft(surebet.startTime);
        
        return `
            <div class="surebet-card">
                <div class="card-header">
                    <div class="match-info">
                        <h3>${surebet.match}</h3>
                        <div class="match-details">
                            <span class="league-badge">${surebet.league}</span>
                            <span class="market-badge">${surebet.market}</span>
                        </div>
                    </div>
                    <div class="profit-info">
                        <div class="countdown-timer">
                            ⏰ ${timeLeft}
                        </div>
                        <div class="profit-display">
                            R$ ${surebet.calculation.profit.toFixed(2)} (${surebet.calculation.profitPercent.toFixed(1)}%)
                        </div>
                    </div>
                </div>
                
                <div class="bets-grid">
                    ${surebet.bets.map(bet => `
                        <div class="bet-option">
                            <div class="bet-info">
                                <h4>${bet.outcome}</h4>
                                <div class="bet-bookmaker">${bet.bookmaker} • ${bet.market}</div>
                            </div>
                            <div class="bet-values">
                                <div class="stake-amount">R$ ${bet.stake.toFixed(2)}</div>
                                <div class="odds-display">Odd: ${bet.odds.toFixed(3)}</div>
                                <a href="${this.bookmakerLinks[bet.bookmaker] || '#'}" 
                                   target="_blank" class="bet-link">
                                    APOSTAR
                                </a>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="card-footer">
                    <div class="total-investment">
                        Total investido: R$ ${(surebet.calculation.stake1 + surebet.calculation.stake2).toFixed(2)}
                    </div>
                    <button class="execute-btn" onclick="markAsExecuted('${surebet.id}')">
                        ✓ Marcar como Executada
                    </button>
                </div>
            </div>
        `;
    }

    getTimeLeft(startTime) {
        const now = new Date();
        const diff = startTime - now;
        
        if (diff <= 0) return "Expirado";
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
            return `${hours}h ${minutes}min`;
        } else if (minutes > 0) {
            return `${minutes}min ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    async fetchRealData() {
        if (!this.apiKey) {
            alert('Por favor, configure sua chave da API primeiro!');
            return;
        }

        const sport = document.getElementById('sportSelect').value;
        const markets = 'h2h,totals,spreads';
        const regions = 'us,br'; // US para odds gerais, BR para casas brasileiras
        const url = `${this.apiUrl}/${sport}/odds?apiKey=${this.apiKey}&regions=${regions}&markets=${markets}&oddsFormat=decimal&dateFormat=iso`;

        try {
            document.getElementById('surebetsContainer').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔄</div>
                    <h3>Conectando com The Odds API...</h3>
                    <p>Buscando odds em tempo real</p>
                    <div class="loading-spinner"></div>
                </div>
            `;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Dados recebidos da API:', data);
            
            if (data.length === 0) {
                throw new Error('Nenhum jogo encontrado para este esporte');
            }
            
            this.processRealData(data);
            this.mockMode = false;
            
        } catch (error) {
            console.error('Erro ao buscar dados reais:', error);
            alert(`Erro ao conectar com a API: ${error.message}\nVerifique sua chave e tente novamente.`);
            
            // Voltar para dados mockados em caso de erro
            this.mockMode = true;
            this.generateMockData();
        }
    }

    processRealData(apiData) {
        const validSurebets = [];
        const minProfit = parseFloat(document.getElementById('minProfit').value) || 3;
        
        apiData.forEach(game => {
            if (!game.bookmakers || game.bookmakers.length < 2) return;
            
            const gameInfo = {
                match: `${game.home_team} vs ${game.away_team}`,
                league: game.sport_title,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                startTime: new Date(game.commence_time)
            };

            // Processar mercado H2H (1x2)
            this.processH2HMarket(game, gameInfo, validSurebets, minProfit);
            
            // Processar mercado Totals (Over/Under)
            this.processTotalsMarket(game, gameInfo, validSurebets, minProfit);
        });
        
        this.surebets = validSurebets;
        this.updateStats();
        this.updateDisplay();
        
        if (validSurebets.length > 0) {
            this.showAlert();
        }
    }

    processH2HMarket(game, gameInfo, validSurebets, minProfit) {
        const h2hBookmakers = game.bookmakers.filter(b => 
            b.markets.some(m => m.key === 'h2h')
        );
        
        if (h2hBookmakers.length < 2) return;
        
        // Encontrar melhores odds para cada resultado
        let bestHome = null, bestDraw = null, bestAway = null;
        
        h2hBookmakers.forEach(bookmaker => {
            const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
            if (h2hMarket) {
                h2hMarket.outcomes.forEach(outcome => {
                    const bookmakerName = this.mapBookmakerName(bookmaker.title);
                    
                    if (outcome.name === gameInfo.homeTeam) {
                        if (!bestHome || outcome.price > bestHome.odds) {
                            bestHome = { odds: outcome.price, bookmaker: bookmakerName };
                        }
                    } else if (outcome.name === gameInfo.awayTeam) {
                        if (!bestAway || outcome.price > bestAway.odds) {
                            bestAway = { odds: outcome.price, bookmaker: bookmakerName };
                        }
                    } else if (outcome.name === 'Draw') {
                        if (!bestDraw || outcome.price > bestDraw.odds) {
                            bestDraw = { odds: outcome.price, bookmaker: bookmakerName };
                        }
                    }
                });
            }
        });
        
        // Testar combinações para surebets
        this.testH2HCombinations(gameInfo, bestHome, bestDraw, bestAway, validSurebets, minProfit);
    }

    testH2HCombinations(gameInfo, bestHome, bestDraw, bestAway, validSurebets, minProfit) {
        if (!bestHome || !bestDraw || !bestAway) return;
        
        // Testar Home vs (Draw + Away)
        if (bestHome.bookmaker !== bestDraw.bookmaker && bestDraw.bookmaker !== bestAway.bookmaker) {
            const drawAwayOdds = 1 / ((1/bestDraw.odds) + (1/bestAway.odds));
            const surebet = this.calculateSurebet(bestHome.odds, drawAwayOdds);
            
            if (surebet && surebet.profitPercent >= minProfit) {
                validSurebets.push({
                    id: this.generateId(),
                    ...gameInfo,
                    market: "1x2",
                    calculation: surebet,
                    bets: [
                        {
                            outcome: `Vitória ${gameInfo.homeTeam}`,
                            bookmaker: bestHome.bookmaker,
                            odds: bestHome.odds,
                            stake: surebet.stake1,
                            market: "1x2 - Vitória Casa"
                        },
                        {
                            outcome: `Empate ou Vitória ${gameInfo.awayTeam}`,
                            bookmaker: bestDraw.bookmaker,
                            odds: drawAwayOdds,
                            stake: surebet.stake2,
                            market: "Dupla Chance - X2"
                        }
                    ]
                });
            }
        }
    }

    processTotalsMarket(game, gameInfo, validSurebets, minProfit) {
        const totalsBookmakers = game.bookmakers.filter(b => 
            b.markets.some(m => m.key === 'totals')
        );
        
        if (totalsBookmakers.length < 2) return;
        
        const totalsData = {};
        
        totalsBookmakers.forEach(bookmaker => {
            const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
            if (totalsMarket) {
                totalsMarket.outcomes.forEach(outcome => {
                    const point = outcome.point;
                    const bookmakerName = this.mapBookmakerName(bookmaker.title);
                    
                    if (!totalsData[point]) {
                        totalsData[point] = { over: null, under: null };
                    }
                    
                    if (outcome.name === 'Over') {
                        if (!totalsData[point].over || outcome.price > totalsData[point].over.odds) {
                            totalsData[point].over = { odds: outcome.price, bookmaker: bookmakerName };
                        }
                    } else if (outcome.name === 'Under') {
                        if (!totalsData[point].under || outcome.price > totalsData[point].under.odds) {
                            totalsData[point].under = { odds: outcome.price, bookmaker: bookmakerName };
                        }
                    }
                });
            }
        });
        
        // Verificar surebets para cada ponto
        Object.entries(totalsData).forEach(([point, data]) => {
            if (data.over && data.under && data.over.bookmaker !== data.under.bookmaker) {
                const surebet = this.calculateSurebet(data.over.odds, data.under.odds);
                
                if (surebet && surebet.profitPercent >= minProfit) {
                    validSurebets.push({
                        id: this.generateId(),
                        ...gameInfo,
                        market: `Over/Under ${point}`,
                        calculation: surebet,
                        bets: [
                            {
                                outcome: `Over ${point} gols`,
                                bookmaker: data.over.bookmaker,
                                odds: data.over.odds,
                                stake: surebet.stake1,
                                market: `Total de Gols - Over ${point}`
                            },
                            {
                                outcome: `Under ${point} gols`,
                                bookmaker: data.under.bookmaker,
                                odds: data.under.odds,
                                stake: surebet.stake2,
                                market: `Total de Gols - Under ${point}`
                            }
                        ]
                    });
                }
            }
        });
    }

    mapBookmakerName(apiName) {
        const mapping = {
            'Bet365': 'Bet365',
            'Betfair': 'Betfair', 
            'KTO': 'KTO',
            'SuperBet': 'SuperBet',
            'BetMGM': 'BetMGM',
            'Betway': 'Betway',
            'Sportingbet': 'Sportingbet',
            'Pinnacle': 'Pinnacle'
        };
        
        return mapping[apiName] || apiName;
    }

    showAlert() {
        const alertPopup = document.getElementById('alertPopup');
        alertPopup.style.display = 'block';
        
        // Som de notificação (se suportado)
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaAzaJ0fDPeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaAzaJ0fDPeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEa');
            audio.play().catch(e => console.log('Audio não disponível'));
        } catch (e) {
            console.log('Audio não suportado');
        }
        
        setTimeout(() => {
            alertPopup.style.display = 'none';
        }, 5000);
    }

    startAutoUpdate() {
        // Atualizar countdown a cada segundo
        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 1000);
        
        // Buscar novos dados a cada 2 minutos (se não estiver em modo mock)
        setInterval(() => {
            if (!this.mockMode && this.apiKey) {
                this.fetchRealData();
            } else if (this.mockMode) {
                // Regenerar dados mock ocasionalmente para simular mudanças
                if (Math.random() < 0.1) { // 10% de chance
                    this.generateMockData();
                }
            }
        }, 120000); // 2 minutos
    }

    generateId() {
        return 'sb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Funções globais para os botões
function saveApiConfig() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (apiKey) {
        localStorage.setItem('oddsApiKey', apiKey);
        surebetHunter.apiKey = apiKey;
        alert('✅ Chave da API salva com sucesso!');
    } else {
        alert('❌ Por favor, digite uma chave válida.');
    }
}

function fetchRealData() {
    surebetHunter.fetchRealData();
}

function markAsExecuted(surebetId) {
    const surebet = surebetHunter.surebets.find(s => s.id === surebetId);
    if (surebet) {
        // Salvar na lista de executadas
        const executedSurebet = {
            ...surebet,
            executedAt: new Date().toISOString()
        };
        surebetHunter.executedSurebets.push(executedSurebet);
        localStorage.setItem('executedSurebets', JSON.stringify(surebetHunter.executedSurebets));
        
        // Remover da lista ativa
        surebetHunter.surebets = surebetHunter.surebets.filter(s => s.id !== surebetId);
        surebetHunter.updateStats();
        surebetHunter.updateDisplay();
        
        // Mostrar feedback
        surebetHunter.showAlert();
        
        // Atualizar estatísticas
        setTimeout(() => {
            alert(`✅ Surebet executada!\nLucro esperado: R$ ${surebet.calculation.profit.toFixed(2)}`);
        }, 100);
    }
}

// Inicializar sistema
let surebetHunter;
document.addEventListener('DOMContentLoaded', function() {
    surebetHunter = new SurebetHunter();
    
    // Solicitar permissão para notificações
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});