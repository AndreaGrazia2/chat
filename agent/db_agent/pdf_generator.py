import os
import uuid
from datetime import datetime
import logging
import traceback
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Configurazione del logger
logger = logging.getLogger('pdf_generator')

class PDFGenerator:
    def __init__(self):
        """Inizializza il generatore PDF"""
        # Assicurati che la directory per i report esista
        from flask import current_app
        # Modifica: rimuovi static_folder dal percorso
        self.reports_dir = os.path.join(current_app.root_path, 'uploads', 'reports')
        os.makedirs(self.reports_dir, exist_ok=True)
        
        logger.info(f"Directory per i report PDF: {self.reports_dir}")
    
    def generate_pdf(self, query_results, title, description):
        """
        Genera un report PDF dai risultati della query
        
        Args:
            query_results: Risultati della query
            title: Titolo del report
            description: Descrizione del report
            
        Returns:
            dict: Informazioni sul PDF generato
        """
        try:
            # Genera un nome file univoco
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            filename = f"report_{timestamp}_{unique_id}.pdf"
            filepath = os.path.join(self.reports_dir, filename)
            
            logger.info(f"Generazione PDF: {filepath}")
            
            # Verifica che i dati siano validi
            if not query_results or not isinstance(query_results, dict):
                raise ValueError("Dati della query non validi")
            
            results = query_results.get('results', [])
            columns = query_results.get('columns', [])
            
            logger.info(f"Colonne: {columns}")
            logger.info(f"Numero di risultati: {len(results)}")
            
            # Usa orientamento orizzontale se ci sono molte colonne
            pagesize = landscape(A4) if len(columns) > 5 else A4
            
            # Crea il documento PDF
            doc = SimpleDocTemplate(
                filepath,
                pagesize=pagesize,
                rightMargin=1.5*cm,
                leftMargin=1.5*cm,
                topMargin=2*cm,
                bottomMargin=2*cm
            )
            
            # Stili migliorati
            styles = getSampleStyleSheet()
            
            # Stile titolo personalizzato
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=18,
                textColor=colors.white,  # Modifica: cambiato da colors.HexColor('#1a237e') a colors.white
                spaceAfter=12,
                spaceBefore=12,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold'
            )
            
            # Stile sottotitolo personalizzato
            subtitle_style = ParagraphStyle(
                'CustomSubtitle',
                parent=styles['Heading2'],
                fontSize=14,
                textColor=colors.white,  # Modifica: cambiato da colors.HexColor('#283593') a colors.white
                spaceAfter=10,
                alignment=TA_LEFT,
                fontName='Helvetica-Bold'
            )
            
            # Stile testo normale personalizzato
            normal_style = ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#333333'),
                spaceAfter=8,
                alignment=TA_LEFT,
                fontName='Helvetica'
            )
            
            # Stile per la data
            date_style = ParagraphStyle(
                'DateStyle',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#666666'),
                alignment=TA_RIGHT,
                fontName='Helvetica-Oblique'
            )
            
            # Elementi del documento
            elements = []
            
            # Titolo
            elements.append(Paragraph(title, title_style))
            elements.append(Spacer(1, 5*mm))
            
            # Descrizione
            if description:
                elements.append(Paragraph(description, normal_style))
                elements.append(Spacer(1, 5*mm))
            
            # Data generazione
            date_text = f"Report generato il {datetime.now().strftime('%d/%m/%Y alle %H:%M:%S')}"
            elements.append(Paragraph(date_text, date_style))
            elements.append(Spacer(1, 10*mm))
            
            # Verifica che ci siano risultati
            if not results:
                elements.append(Paragraph("Nessun risultato trovato nella query.", normal_style))
            else:
                # Prepara i dati per la tabella
                table_data = []
                
                # Aggiungi intestazioni
                header_row = []
                for col in columns:
                    # Formatta le intestazioni per renderle più leggibili
                    header = col.replace('_', ' ').title()
                    header_row.append(Paragraph(header, styles['Heading4']))
                table_data.append(header_row)
                
                # Aggiungi righe di dati
                for row in results:
                    data_row = []
                    for col in columns:
                        value = row.get(col, '')
                        
                        # Gestisci valori None
                        if value is None:
                            value = ""
                        
                        # Formatta i valori per renderli più leggibili
                        if isinstance(value, dict) or isinstance(value, list):
                            # Converti JSON in stringa formattata
                            try:
                                value = json.dumps(value, indent=2, ensure_ascii=False)
                            except:
                                value = str(value)
                        
                        # Tronca stringhe troppo lunghe
                        if isinstance(value, str) and len(value) > 100:
                            value = value[:97] + "..."
                        
                        # Converti in Paragraph per formattazione migliore
                        data_row.append(Paragraph(str(value), normal_style))
                    
                    table_data.append(data_row)
                
                # Calcola larghezze colonne
                available_width = doc.width
                col_widths = []
                
                # Imposta larghezze colonne in base al tipo di dati
                for i, col in enumerate(columns):
                    if col in ['id', 'user_id', 'conversation_id', 'reply_to_id']:
                        # Colonne ID più strette
                        col_widths.append(available_width * 0.07)
                    elif col in ['created_at', 'edited_at']:
                        # Colonne data di larghezza media
                        col_widths.append(available_width * 0.12)
                    elif col in ['text', 'message_type', 'metadata']:
                        # Colonne di testo più larghe
                        col_widths.append(available_width * 0.2)
                    else:
                        # Altre colonne di larghezza standard
                        col_widths.append(available_width * 0.1)
                
                # Normalizza le larghezze se necessario
                total_width = sum(col_widths)
                if total_width > available_width:
                    scale_factor = available_width / total_width
                    col_widths = [w * scale_factor for w in col_widths]
                
                # Crea la tabella con le larghezze calcolate
                table = Table(table_data, repeatRows=1, colWidths=col_widths)
                
                # Stile della tabella migliorato
                table_style = TableStyle([
                    # Intestazione
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    
                    # Righe alternate
                    ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
                ])
                
                # Aggiungi colori alternati per le righe
                for i in range(1, len(table_data)):
                    if i % 2 == 0:
                        table_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f5f5f5'))
                
                # Aggiungi bordi e padding
                table_style.add('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc'))
                table_style.add('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#1a237e'))
                table_style.add('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#1a237e'))
                table_style.add('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#1a237e'))
                table_style.add('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
                table_style.add('LEFTPADDING', (0, 0), (-1, -1), 6)
                table_style.add('RIGHTPADDING', (0, 0), (-1, -1), 6)
                table_style.add('TOPPADDING', (0, 1), (-1, -1), 6)
                table_style.add('BOTTOMPADDING', (0, 1), (-1, -1), 6)
                
                table.setStyle(table_style)
                elements.append(table)
            
            # Genera il PDF
            doc.build(elements)
            
            logger.info(f"PDF generato con successo: {filepath}")
            
            return {
                'success': True,
                'filename': filename,
                'filepath': filepath
            }
        except Exception as e:
            logger.error(f"Errore nella generazione del PDF: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }