def calculate_kelly_percentage(odds: float, true_prob: float, bankroll_fraction: float = 0.5) -> float:
    """
    Calculate Kelly Criterion percentage.
    Formula: f* = (bp - q) / b
    b = odds - 1
    p = true probability
    q = 1 - p
    
    Args:
        odds (float): Decimal odds (e.g., 2.50)
        true_prob (float): True probability (e.g., 0.45)
        bankroll_fraction (float): Fractional Kelly (default 0.5 for safety)
        
    Returns:
        float: Percentage of bankroll to bet (0.0 to 1.0)
    """
    if odds <= 1:
        return 0.0
        
    b = odds - 1
    q = 1 - true_prob
    
    f_star = (b * true_prob - q) / b
    
    # Apply fractional Kelly (Safety)
    f_safe = f_star * bankroll_fraction
    
    return max(0.0, round(f_safe, 4))

def calculate_tax_free_limit(odds: float, bet_amount_limit: int = 100000) -> int:
    """
    Calculate the maximum stake that remains TAX-FREE.
    
    Betman Tax Rules (22% Tax):
    1. Odds > 100.0 AND Winnings > 100,000 KRW -> Taxed.
    2. Winnings > 2,000,000 KRW -> Taxed (Regardless of odds).
    
    We want to find Stake S such that:
    - If Odds > 100: (S * Odds) <= 100,000
    - Else: (S * Odds) <= 2,000,000
    
    AND S <= 100,000 (Legal purchase limit)
    
    Args:
        odds (float): Betman odds.
        bet_amount_limit (int): Personal daily limit (default 100k).
        
    Returns:
        int: Maximum tax-free stake (rounded down to 100 won).
    """
    if odds <= 1.0:
        return 0
        
    # Rule 1: High Odds Tax (>100x)
    if odds > 100.0:
        limit_winnings = 100000
    else:
        limit_winnings = 2000000
        
    # Max Stake = Limit / Odds
    max_stake_raw = limit_winnings / odds
    
    # Cap at Betman Limit (100k per ticket)
    # Actually per ticket is 100k. Users can buy multiple tickets but
    # usually we optimize per ticket.
    limit_ticket = 100000
    
    final_limit = min(max_stake_raw, limit_ticket)
    
    # Round down to nearest 100 KRW (Betman minimum unit)
    return int(final_limit // 100) * 100
