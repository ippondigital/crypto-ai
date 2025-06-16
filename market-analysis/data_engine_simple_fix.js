    /**
     * Initialize the data engine - SIMPLIFIED VERSION
     */
    async init() {
        console.log('🚀 Starting Data Engine...');
        
        try {
            this.updateStatusIndicator('🔄 Loading...', 'loading');
            
            // Load static data first
            await this.loadData();
            await this.bindAll();
            await this.renderTemplatesSafely();
            
            console.log('✅ Static data loaded');
            this.updateStatusIndicator('🟢 Live Data Active', 'success');
            
            // SIMPLE SOLUTION: Auto-refresh live data after page loads
            setTimeout(async () => {
                console.log('🔄 Auto-loading live data...');
                try {
                    await this.refreshLiveData();
                    console.log('✅ Live data loaded automatically');
                } catch (error) {
                    console.error('❌ Auto live data failed, using static data');
                }
            }, 3000);
            
            // Start regular auto-refresh
            this.startAutoRefresh(60);
            
        } catch (error) {
            console.error('❌ Data Engine initialization failed:', error);
            this.updateStatusIndicator('🔴 Error', 'error');
        }
    }
