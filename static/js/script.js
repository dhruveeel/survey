// Global variables
let sessionId = null;
let currentPairIndex = 0;
let dependencyPairs = [];

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Step navigation
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');
    
    const panel1 = document.getElementById('panel1');
    const panel2 = document.getElementById('panel2');
    const panel3 = document.getElementById('panel3');
    const panel4 = document.getElementById('panel4');
    const panelComplete = document.getElementById('panel-complete');
    
    const nextToStep2Btn = document.getElementById('next-to-step2');
    const nextToStep3Btn = document.getElementById('next-to-step3');
    const nextToStep4Btn = document.getElementById('next-to-step4');
    const backToStep1Btn = document.getElementById('back-to-step1');
    const backToStep2Btn = document.getElementById('back-to-step2');
    const backToStep3Btn = document.getElementById('back-to-step3');
    const finishBtn = document.getElementById('finish-button');
    const restartBtn = document.getElementById('restart-button');
    
    // Variable management
    const addVariableBtn = document.getElementById('add-variable');
    const variableList = document.getElementById('variable-list');
    
    // Dependency elements
    const dependencyQuestion = document.getElementById('dependency-question');
    const graphImage = document.getElementById('graph-image');
    const finalGraphImage = document.getElementById('final-graph-image');
    const cyclesWarning = document.getElementById('cycles-warning');
    const dependenciesList = document.getElementById('dependencies-list');
    
    // Variable values elements
    const variableValuesList = document.getElementById('variable-values-list');
    const variablesSummary = document.getElementById('variables-summary');
    
    // Modal elements
    const errorModal = document.getElementById('error-modal');
    const cycleModal = document.getElementById('cycle-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const closeCycleModalBtn = document.querySelector('#cycle-modal .close-button');
    const errorMessage = document.getElementById('error-message');
    const cycleDetails = document.getElementById('cycle-details');
    const keepCycleBtn = document.getElementById('keep-cycle-btn');
    const removeCycleBtn = document.getElementById('remove-cycle-btn');
    
    // Initialize delete variable buttons
    initDeleteVariableButtons();
    
    // Navigation event listeners
    nextToStep2Btn.addEventListener('click', function() {
        // Validate user information
        const name = document.getElementById('name').value.trim();
        const position = document.getElementById('position').value.trim();
        const email = document.getElementById('email').value.trim();
        
        if (!name || !position || !email) {
            showError('Please fill in all fields.');
            return;
        }
        
        if (!isValidEmail(email)) {
            showError('Please enter a valid email address.');
            return;
        }
        
        // Submit user information
        fetch('/submit_user_info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, position, email }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                sessionId = data.session_id;
                
                // Navigate to step 2
                step1.classList.add('completed');
                step2.classList.add('active');
                panel1.classList.remove('active');
                panel2.classList.add('active');
            } else {
                showError(data.error || 'An error occurred while submitting user information.');
            }
        })
        .catch(error => {
            showError('An error occurred while submitting user information.');
            console.error('Error:', error);
        });
    });
    
    nextToStep3Btn.addEventListener('click', function() {
        // Validate variables
        const variableInputs = document.querySelectorAll('.variable-input');
        const variables = [];
        
        for (const input of variableInputs) {
            const value = input.value.trim();
            if (value) {
                variables.push(value);
            }
        }
        
        if (variables.length < 2) {
            showError('Please enter at least 2 variables.');
            return;
        }
        
        // Check for duplicate variables
        const uniqueVariables = new Set(variables);
        if (uniqueVariables.size !== variables.length) {
            showError('Please ensure all variable names are unique.');
            return;
        }
        
        // Submit variables
        fetch('/submit_variables', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session_id: sessionId, variables }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Navigate to step 3
                step2.classList.add('completed');
                step3.classList.add('active');
                panel2.classList.remove('active');
                panel3.classList.add('active');
                
                // Load dependency pairs
                loadDependencyPairs();
            } else {
                showError(data.error || 'An error occurred while submitting variables.');
            }
        })
        .catch(error => {
            showError('An error occurred while submitting variables.');
            console.error('Error:', error);
        });
    });
    
    nextToStep4Btn.addEventListener('click', function() {
        // Navigate to step 4 (Variable Values)
        step3.classList.add('completed');
        step4.classList.add('active');
        panel3.classList.remove('active');
        panel4.classList.add('active');
        
        // Load variables for value input
        loadVariablesForValues();
    });
    
    backToStep1Btn.addEventListener('click', function() {
        step2.classList.remove('active');
        panel2.classList.remove('active');
        panel1.classList.add('active');
    });
    
    backToStep2Btn.addEventListener('click', function() {
        step3.classList.remove('active');
        panel3.classList.remove('active');
        panel2.classList.add('active');
    });
    
    backToStep3Btn.addEventListener('click', function() {
        step4.classList.remove('active');
        panel4.classList.remove('active');
        panel3.classList.add('active');
    });
    
    finishBtn.addEventListener('click', function() {
        // Collect variable values
        const valueInputs = document.querySelectorAll('.variable-value-input');
        const variableValues = {};
        
        valueInputs.forEach(input => {
            variableValues[input.dataset.variable] = input.value.trim();
        });
        
        // Submit variable values
        fetch('/submit_variable_values', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                session_id: sessionId, 
                variable_values: variableValues 
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Save final results
                saveResults(variableValues);
            } else {
                showError(data.error || 'An error occurred while submitting variable values.');
            }
        })
        .catch(error => {
            showError('An error occurred while submitting variable values.');
            console.error('Error:', error);
        });
    });
    
    restartBtn.addEventListener('click', function() {
        // Reset everything and go back to step 1
        sessionId = null;
        currentPairIndex = 0;
        dependencyPairs = [];
        
        // Reset form fields
        document.getElementById('name').value = '';
        document.getElementById('position').value = '';
        document.getElementById('email').value = '';
        
        // Reset variables
        const defaultVariables = ['Variable 1', 'Variable 2', 'Variable 3', 'Variable 4', 'Variable 5'];
        const variableInputs = document.querySelectorAll('.variable-input');
        
        // If there are more variable inputs than defaults, remove extras
        while (variableList.children.length > defaultVariables.length) {
            variableList.removeChild(variableList.lastChild);
        }
        
        // If there are less variable inputs than defaults, add more
        while (variableList.children.length < defaultVariables.length) {
            addVariable();
        }
        
        // Reset values
        variableInputs.forEach((input, index) => {
            input.value = '';
            input.placeholder = defaultVariables[index] || 'Variable';
        });
        
        // Reset steps
        step1.classList.remove('completed');
        step2.classList.remove('active', 'completed');
        step3.classList.remove('active', 'completed');
        step4.classList.remove('active', 'completed');
        
        // Reset panels
        panelComplete.classList.remove('active');
        panel1.classList.add('active');
        
        // Reset cycle warning
        cyclesWarning.innerHTML = '';
        cyclesWarning.classList.remove('active');
        
        // Reset dependencies list
        dependenciesList.innerHTML = '';
    });
    
    // Variable management
    addVariableBtn.addEventListener('click', function() {
        addVariable();
    });
    
    // Modal handling
    closeModalBtn.addEventListener('click', function() {
        errorModal.style.display = 'none';
    });
    
    if (closeCycleModalBtn) {
        closeCycleModalBtn.addEventListener('click', function() {
            cycleModal.style.display = 'none';
        });
    }
    
    if (keepCycleBtn) {
        keepCycleBtn.addEventListener('click', function() {
            cycleModal.style.display = 'none';
        });
    }
    
    if (removeCycleBtn) {
        removeCycleBtn.addEventListener('click', function() {
            // Remove the last added dependency
            if (sessionId && dependencyPairs.length > 0) {
                const lastDependency = dependencyPairs[currentPairIndex - 1];
                
                fetch('/remove_dependency', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        session_id: sessionId, 
                        source: lastDependency.source, 
                        target: lastDependency.target 
                    }),
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Update graph image
                        graphImage.src = data.image;
                        
                        // Update cycles warning
                        updateCyclesWarning(data.cycles);
                        
                        // Update dependencies list
                        updateDependenciesList(data.dependencies);
                        
                        cycleModal.style.display = 'none';
                    } else {
                        showError(data.error || 'An error occurred while removing dependency.');
                    }
                })
                .catch(error => {
                    showError('An error occurred while removing dependency.');
                    console.error('Error:', error);
                });
            }
        });
    }
    
    window.addEventListener('click', function(event) {
        if (event.target === errorModal) {
            errorModal.style.display = 'none';
        }
        if (event.target === cycleModal) {
            cycleModal.style.display = 'none';
        }
    });
    
    // Functions
    function addVariable() {
        const itemCount = variableList.children.length;
        const newItem = document.createElement('div');
        newItem.className = 'variable-item';
        newItem.innerHTML = `
            <input type="text" placeholder="Variable ${itemCount + 1}" class="variable-input">
            <button class="btn delete-variable"><i class="fas fa-trash"></i></button>
        `;
        
        variableList.appendChild(newItem);
        
        // Add event listener to the delete button
        const deleteBtn = newItem.querySelector('.delete-variable');
        deleteBtn.addEventListener('click', function() {
            variableList.removeChild(newItem);
            updateVariablePlaceholders();
        });
    }
    
    function initDeleteVariableButtons() {
        const deleteButtons = document.querySelectorAll('.delete-variable');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Ensure we always have at least one variable
                if (variableList.children.length > 1) {
                    const variableItem = button.parentElement;
                    variableList.removeChild(variableItem);
                    updateVariablePlaceholders();
                } else {
                    showError('You must have at least one variable.');
                }
            });
        });
    }
    
    function updateVariablePlaceholders() {
        const variableInputs = document.querySelectorAll('.variable-input');
        variableInputs.forEach((input, index) => {
            input.placeholder = `Variable ${index + 1}`;
        });
    }
    
    function loadDependencyPairs() {
        fetch('/get_dependency_options?session_id=' + sessionId)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dependencyPairs = data.pairs;
                currentPairIndex = 0;
                
                // Load initial graph
                fetch('/get_current_graph?session_id=' + sessionId)
                .then(response => response.json())
                .then(graphData => {
                    if (graphData.success) {
                        graphImage.src = graphData.image;
                        
                        // Display first dependency question
                        if (dependencyPairs.length > 0) {
                            displayDependencyQuestion();
                        } else {
                            dependencyQuestion.innerHTML = `
                                <p>No variable dependencies to define.</p>
                            `;
                        }
                    }
                });
            } else {
                showError(data.error || 'An error occurred while loading dependency options.');
            }
        })
        .catch(error => {
            showError('An error occurred while loading dependency options.');
            console.error('Error:', error);
        });
    }
    
    function displayDependencyQuestion() {
        if (currentPairIndex < dependencyPairs.length) {
            const pair = dependencyPairs[currentPairIndex];
            
            dependencyQuestion.innerHTML = `
                <p>Does <strong>${pair.source}</strong> affect <strong>${pair.target}</strong>?</p>
                <div class="dependency-btns">
                    <button class="btn yes" id="yes-dependency">Yes <i class="fas fa-check"></i></button>
                    <button class="btn no" id="no-dependency">No <i class="fas fa-times"></i></button>
                </div>
            `;
            
            // Add event listeners to buttons
            document.getElementById('yes-dependency').addEventListener('click', function() {
                addDependency(pair.source, pair.target);
            });
            
            document.getElementById('no-dependency').addEventListener('click', function() {
                // Just move to the next question
                currentPairIndex++;
                displayDependencyQuestion();
            });
        }
    }
    
    function addDependency(source, target) {
        fetch('/add_dependency', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                session_id: sessionId, 
                source: source, 
                target: target 
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update graph image
                graphImage.src = data.image;
                
                // Update dependencies list
                updateDependenciesList(data.dependencies);
                
                // Check for cycles
                if (data.cycles_detected) {
                    // Show cycle warning but don't prevent continuation
                    updateCyclesWarning(data.cycles);
                    
                    // Show the cycle modal
                    //showCycleModal(data.cycles);
                }
                
                // Move to next question
                currentPairIndex++;
                displayDependencyQuestion();
            } else {
                showError(data.error || 'An error occurred while adding dependency.');
            }
        })
        .catch(error => {
            showError('An error occurred while adding dependency.');
            console.error('Error:', error);
        });
    }
    
    function updateDependenciesList(dependencies) {
        dependenciesList.innerHTML = '';
        
        if (dependencies.length === 0) {
            dependenciesList.innerHTML = '<p>No dependencies added yet.</p>';
            return;
        }
        
        dependencies.forEach(dependency => {
            const item = document.createElement('div');
            item.className = 'dependency-item';
            item.innerHTML = `
                <div class="dependency-text">
                    <span>${dependency.source}</span>
                    <span class="arrow"><i class="fas fa-arrow-right"></i></span>
                    <span>${dependency.target}</span>
                </div>
                <button class="btn remove-dependency" data-source="${dependency.source}" data-target="${dependency.target}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            dependenciesList.appendChild(item);
            
            // Add event listener to remove button
            const removeBtn = item.querySelector('.remove-dependency');
            removeBtn.addEventListener('click', function() {
                removeDependency(dependency.source, dependency.target);
            });
        });
    }
    
    function updateCyclesWarning(cycles) {
        if (cycles && cycles.length > 0) {
            cyclesWarning.innerHTML = `
                <h3><i class="fas fa-exclamation-circle"></i> Cycles Detected</h3>
                <p>The following cycles have been detected in your dependencies:</p>
            `;
            
            cycles.forEach((cycle, index) => {
                const cycleItem = document.createElement('div');
                cycleItem.className = 'cycle-item';
                cycleItem.textContent = cycle.join(' → ') + ' → ' + cycle[0];
                cyclesWarning.appendChild(cycleItem);
            });
            
            cyclesWarning.classList.add('active');
        } else {
            cyclesWarning.innerHTML = '';
            cyclesWarning.classList.remove('active');
        }
    }
    
    function showCycleModal(cycles) {
        cycleDetails.innerHTML = '';
        
        cycles.forEach((cycle, index) => {
            const cycleItem = document.createElement('div');
            cycleItem.className = 'cycle-item';
            cycleItem.textContent = cycle.join(' → ') + ' → ' + cycle[0];
            cycleDetails.appendChild(cycleItem);
        });
        
        cycleModal.style.display = 'flex';
    }
    
    function removeDependency(source, target) {
        fetch('/remove_dependency', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                session_id: sessionId, 
                source: source, 
                target: target 
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update graph image
                graphImage.src = data.image;
                
                // Update cycles warning
                updateCyclesWarning(data.cycles);
                
                // Update dependencies list
                updateDependenciesList(data.dependencies);
            } else {
                showError(data.error || 'An error occurred while removing dependency.');
            }
        })
        .catch(error => {
            showError('An error occurred while removing dependency.');
            console.error('Error:', error);
        });
    }
    
    function loadVariablesForValues() {
        fetch('/get_variables_for_values?session_id=' + sessionId)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                variableValuesList.innerHTML = '';
                
                data.variables.forEach(variable => {
                    const item = document.createElement('div');
                    item.className = 'variable-value-item';
                    item.innerHTML = `
                        <div class="variable-name">${variable}:</div>
                        <input type="text" class="variable-value-input" data-variable="${variable}" placeholder="Enter value for ${variable}">
                    `;
                    
                    variableValuesList.appendChild(item);
                });
            } else {
                showError(data.error || 'An error occurred while loading variables.');
            }
        })
        .catch(error => {
            showError('An error occurred while loading variables.');
            console.error('Error:', error);
        });
    }
    
    function saveResults(variableValues) {
        fetch('/save_results?session_id=' + sessionId, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show completion panel
                panel4.classList.remove('active');
                panelComplete.classList.add('active');
                
                // Update final graph
                fetch('/get_current_graph?session_id=' + sessionId)
                .then(response => response.json())
                .then(graphData => {
                    if (graphData.success) {
                        finalGraphImage.src = graphData.image;
                        
                        // Display variables summary
                        variablesSummary.innerHTML = '<h3>Variable Values</h3>';
                        
                        for (const [variable, value] of Object.entries(variableValues)) {
                            const item = document.createElement('div');
                            item.className = 'variable-summary-item';
                            item.innerHTML = `
                                <div class="variable-label">${variable}:</div>
                                <div class="variable-value">${value || 'No value provided'}</div>
                            `;
                            
                            variablesSummary.appendChild(item);
                        }
                    }
                });
            } else {
                showError(data.error || 'An error occurred while saving results.');
            }
        })
        .catch(error => {
            showError('An error occurred while saving results.');
            console.error('Error:', error);
        });
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        errorModal.style.display = 'flex';
    }
    
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    // Initialize with some default variables
    for (let i = 0; i < 5; i++) {
        const variableInputs = document.querySelectorAll('.variable-input');
        if (variableInputs.length < 5) {
            addVariable();
        }
    }
});